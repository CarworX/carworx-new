import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { sql, stack } from "./harness";

// P2-4 (Codex bot P1 on #57 @bd453a3): a claimant's direct membership grant
// that starts while an upheld reversal is still uncommitted must not land
// after it. Two real database sessions: the reversal holds its transaction
// open until the grant is seen waiting on a lock. SYNTHETIC DATA ONLY.

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
    if (Date.now() > deadline)
      throw Error("Concurrent membership check timed out");
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

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

function waitingOnLock(application: string): boolean {
  const r = rows(
    `select exists(select from pg_stat_activity where application_name='${application}' and wait_event_type='Lock')`,
  );
  return r[0] === "t";
}

function as(user: string, aal: "aal1" | "aal2", call: string): string {
  return `set local role authenticated; set local request.jwt.claims = '{"sub":"${user}","role":"authenticated","aal":"${aal}"}'; ${call};`;
}

/** O was displaced by claimant A (approved claim), O's dispute is open, Z is A's second account. */
function fixture() {
  const id = () => randomUUID();
  const [owner, claimant, second, admin, org, listing, claim, dispute] = [
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
      ('${owner}', 'grant-owner-${owner.slice(0, 8)}@example.test', now()),
      ('${claimant}', 'grant-claimant-${claimant.slice(0, 8)}@example.test', now()),
      ('${second}', 'grant-second-${second.slice(0, 8)}@example.test', now()),
      ('${admin}', 'grant-admin-${admin.slice(0, 8)}@example.test', now());
    insert into private.platform_admins(user_id) values ('${admin}');
    insert into public.organisations(id, name) values ('${org}', 'Grant Race Motors (synthetic)');
    insert into public.memberships(organisation_id, user_id, role, status) values
      ('${org}', '${claimant}', 'owner', 'active'), ('${org}', '${owner}', 'owner', 'revoked');
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      values ('${listing}', '${org}', 'mobile-repair', 'Grant race listing (synthetic)', 'Synthetic race fixture', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-grant-race');
    insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference, status, review_method, decided_by, decided_at, approved_at, displaced_user_ids, displaced_roles)
      values ('${claim}', '${listing}', '${org}', '${claimant}', 'document', 'Synthetic ref', 'disputed', 'phone_call', '${admin}', now(), clock_timestamp(), array['${owner}'::uuid], array['owner']);
    insert into public.claim_disputes(id, claim_id, organisation_id, raised_by, reason)
      values ('${dispute}', '${claim}', '${org}', '${owner}', 'Synthetic: the transfer was wrong');
  `);
  return {
    org,
    owner,
    second,
    uphold: as(
      admin,
      "aal2",
      `select public.admin_resolve_dispute('${dispute}', 'uphold', 'Synthetic: transfer reversed')`,
    ),
    grant: as(
      claimant,
      "aal1",
      `insert into public.memberships(organisation_id, user_id, role, status) values ('${org}', '${second}', 'owner', 'active')`,
    ),
  };
}

for (const outcome of ["commit", "rollback"] as const)
  it(`a claimant's grant waits for a reversal and is rechecked (reversal ${outcome === "commit" ? "commits" : "rolls back"})`, async () => {
    const f = fixture();
    const application = `grant-race-${randomUUID()}`;
    const reversal = session(),
      grant = session();
    try {
      reversal.child.stdin.write(`begin; ${f.uphold}\n\\echo FIRST_HELD\n`);
      await until(() => reversal.output().includes("FIRST_HELD"));
      grant.child.stdin.end(
        `set application_name='${application}'; begin; ${f.grant} commit;\n`,
      );
      let finished = false;
      void grant.done.then(() => {
        finished = true;
      });
      await until(() => finished || waitingOnLock(application));
      expect(finished).toBe(false);
      reversal.child.stdin.end(`${outcome};\n`);
      expect(await reversal.done).toBe(0);
      const status = await grant.done;
      const active = rows(
        `select user_id from public.memberships where organisation_id = '${f.org}' and status = 'active' order by user_id`,
      );
      if (outcome === "commit") {
        expect(status).not.toBe(0);
        expect(grant.errors()).toContain("42501");
        expect(active).toEqual([f.owner]);
      } else {
        expect(status).toBe(0);
        expect(active).toContain(f.second);
        expect(active).not.toContain(f.owner);
      }
    } finally {
      reversal.child.kill();
      grant.child.kill();
      await Promise.allSettled([reversal.done, grant.done]);
    }
  });
