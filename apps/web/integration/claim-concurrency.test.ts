import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { sql, stack } from "./harness";

// P2-4 (Claude 21, Codex 23 finding): disputing approved claim A and
// approving a later claim B on the same organisation must not both commit.
// Two real database sessions; the first holds its transaction open until the
// second is seen waiting on a lock, then commits. SYNTHETIC DATA ONLY.

function connection() {
  const flags = ["-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"];
  if (spawnSync("psql", ["--version"]).status === 0)
    return { command: "psql", args: [...flags, stack.dbUrl] };
  const project = /^project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync(join(stack.root, "supabase/config.toml"), "utf8"),
  )?.[1];
  if (!project) throw Error("Missing synthetic project");
  const inner = new URL(stack.dbUrl);
  inner.hostname = "127.0.0.1";
  inner.port = "5432";
  return {
    command: "docker",
    args: [
      "exec",
      "-i",
      `supabase_db_${project}`,
      "psql",
      ...flags,
      inner.toString(),
    ],
  };
}

function session() {
  const c = connection();
  const child = spawn(c.command, c.args, { stdio: "pipe" });
  let output = "",
    errors = "";
  child.stdout.on("data", (data: Buffer) => {
    output += data.toString();
  });
  child.stderr.on("data", (data: Buffer) => {
    errors += data.toString();
  });
  const done = new Promise<number | null>((resolve, reject) => {
    child.once("close", resolve);
    child.once("error", () => {
      reject(Error("Private database process failed"));
    });
  });
  return { child, done, output: () => output, errors: () => errors };
}

async function until(check: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (!check()) {
    if (Date.now() > deadline) throw Error("Concurrent claim check timed out");
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

function waitingOnLock(application: string): boolean {
  const c = connection();
  const r = spawnSync(c.command, c.args, {
    input: `select exists(select from pg_stat_activity where application_name='${application}' and wait_event_type='Lock');`,
    encoding: "utf8",
    timeout: 3000,
  });
  return r.status === 0 && r.stdout.trim() === "t";
}

/** One query on its own connection; rows as unaligned text. */
function rows(statement: string): string[] {
  const c = connection();
  const r = spawnSync(c.command, c.args, {
    input: `${statement};`,
    encoding: "utf8",
    timeout: 5000,
  });
  if (r.status !== 0) throw Error("query failed");
  return r.stdout.split("\n").filter((line) => line !== "");
}

function as(user: string, aal: "aal1" | "aal2", call: string): string {
  return `set local role authenticated; set local request.jwt.claims = '{"sub":"${user}","role":"authenticated","aal":"${aal}"}'; ${call};`;
}

/** An organisation whose control moved O → A (claim A approved); B has a pending claim. */
function fixture() {
  const id = () => randomUUID();
  const [owner, claimantA, claimantB, admin, org, listing, claimA, claimB] = [
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
  ];
  sql(`
    insert into auth.users(id, email, email_confirmed_at) values
      ('${owner}', 'race-owner-${owner.slice(0, 8)}@example.test', now()),
      ('${claimantA}', 'race-a-${claimantA.slice(0, 8)}@example.test', now()),
      ('${claimantB}', 'race-b-${claimantB.slice(0, 8)}@example.test', now()),
      ('${admin}', 'race-admin-${admin.slice(0, 8)}@example.test', now());
    insert into private.platform_admins(user_id) values ('${admin}');
    insert into public.organisations(id, name) values ('${org}', 'Race Motors (synthetic)');
    insert into public.memberships(organisation_id, user_id, role, status) values
      ('${org}', '${claimantA}', 'owner', 'active'), ('${org}', '${owner}', 'owner', 'revoked');
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      values ('${listing}', '${org}', 'mobile-repair', 'Race listing (synthetic)', 'Synthetic race fixture', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-race');
    insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference, status, review_method, decided_by, decided_at, approved_at, displaced_user_ids, displaced_roles)
      values ('${claimA}', '${listing}', '${org}', '${claimantA}', 'document', 'Synthetic ref A', 'approved', 'phone_call', '${admin}', now(), clock_timestamp(), array['${owner}'::uuid], array['owner']);
    insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference)
      values ('${claimB}', '${listing}', '${org}', '${claimantB}', 'document', 'Synthetic ref B');
  `);
  return {
    org,
    owner,
    claimantA,
    claimantB,
    claimA,
    claimB,
    dispute: as(
      owner,
      "aal1",
      `select public.dispute_claim('${claimA}', 'Synthetic: the transfer to A was wrong')`,
    ),
    approve: as(
      admin,
      "aal2",
      `select public.admin_decide_claim('${claimB}', 'approve', 'phone_call', null)`,
    ),
  };
}

for (const first of ["dispute", "approval"] as const)
  for (const commit of [true, false])
    it(`serializes claim decisions (${first} first, ${commit ? "commit" : "rollback"})`, async () => {
      const f = fixture();
      const application = `claim-race-${randomUUID()}`;
      const [firstSql, secondSql] =
        first === "dispute" ? [f.dispute, f.approve] : [f.approve, f.dispute];
      const one = session(),
        two = session();
      try {
        one.child.stdin.write(
          `set statement_timeout='15s'; begin; ${firstSql}\n\\echo FIRST_HELD\n`,
        );
        await until(() => one.output().includes("FIRST_HELD"));
        two.child.stdin.end(
          `set statement_timeout='15s'; set application_name='${application}'; begin; ${secondSql} commit;\n`,
        );
        // Either it waits on the first session's lock (correct), or it was
        // never blocked and has already finished (the race).
        let finished = false;
        void two.done.then(() => {
          finished = true;
        });
        await until(() => finished || waitingOnLock(application));
        const blocked = waitingOnLock(application);
        one.child.stdin.end(`${commit ? "commit" : "rollback"};\n`);
        expect(await one.done).toBe(0);
        const status = await two.done;
        expect(blocked).toBe(true);
        if (commit) {
          expect(status).not.toBe(0);
          expect(two.errors()).toContain(
            first === "dispute" ? "transfer_disputed" : "claim_superseded",
          );
        } else expect(status).toBe(0);
        const disputed = commit ? first === "dispute" : first === "approval";
        const states = rows(
          `select status from public.listing_claims where id in ('${f.claimA}', '${f.claimB}') order by id = '${f.claimB}'`,
        );
        expect(states).toEqual(
          disputed ? ["disputed", "submitted"] : ["approved", "approved"],
        );
        expect(
          rows(
            `select count(*) from public.claim_disputes where claim_id = '${f.claimA}'`,
          ),
        ).toEqual([disputed ? "1" : "0"]);
        // No partial transfer survives either a rejected or rolled-back approval.
        expect(
          rows(`select user_id::text || ':' || role || ':' || status
        from public.memberships where organisation_id='${f.org}' order by user_id`),
        ).toEqual(
          (disputed
            ? [`${f.owner}:owner:revoked`, `${f.claimantA}:owner:active`]
            : [
                `${f.owner}:owner:revoked`,
                `${f.claimantA}:owner:revoked`,
                `${f.claimantB}:owner:active`,
              ]
          ).sort(),
        );
        expect(
          rows(`select cardinality(displaced_user_ids)::text || ':' || cardinality(displaced_roles)::text
        from public.listing_claims where id='${f.claimB}'`),
        ).toEqual([disputed ? "0:0" : "1:1"]);
      } finally {
        one.child.kill();
        two.child.kill();
        await Promise.allSettled([one.done, two.done]);
      }
    });
