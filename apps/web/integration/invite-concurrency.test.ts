import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { sql, stack } from "./harness";

// O2 (Codex P1 on #79): redeeming an invite and transferring control of the
// organisation must serialise. An invite made by the old owner never yields
// access after the transfer commits, and access gained just before a transfer
// is revoked by it. Two real database sessions; the first holds its
// transaction open until the second is seen waiting on a lock, then commits
// or rolls back. SYNTHETIC DATA ONLY.

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
    if (Date.now() > deadline) throw Error("Concurrent invite check timed out");
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

/** Owner O holds an unused manager invite; claimant C has a pending claim. */
function fixture() {
  const id = () => randomUUID();
  const [owner, claimant, invitee, admin, org, listing, claim] = [
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
  ];
  // 32 random bytes, base64url without padding: the shape create_invite returns.
  const token = randomBytes(32).toString("base64url");
  sql(`
    insert into auth.users(id, email, email_confirmed_at) values
      ('${owner}', 'inv-owner-${owner.slice(0, 8)}@example.test', now()),
      ('${claimant}', 'inv-claim-${claimant.slice(0, 8)}@example.test', now()),
      ('${invitee}', 'inv-guest-${invitee.slice(0, 8)}@example.test', now()),
      ('${admin}', 'inv-admin-${admin.slice(0, 8)}@example.test', now());
    insert into private.platform_admins(user_id) values ('${admin}');
    insert into public.organisations(id, name) values ('${org}', 'Invite Race Motors (synthetic)');
    insert into public.memberships(organisation_id, user_id, role, status) values ('${org}', '${owner}', 'owner', 'active');
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      values ('${listing}', '${org}', 'mobile-repair', 'Invite race listing (synthetic)', 'Synthetic race fixture', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-race');
    insert into public.invites(organisation_id, role, token_hash, created_by, control_generation)
      select '${org}', 'manager', private.invite_token_hash('${token}'), '${owner}', o.control_generation
      from public.organisations o where o.id = '${org}';
    insert into public.listing_claims(id, listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference)
      values ('${claim}', '${listing}', '${org}', '${claimant}', 'document', 'Synthetic ref');
  `);
  return {
    org,
    owner,
    claimant,
    invitee,
    accept: as(invitee, "aal1", `select public.accept_invite('${token}')`),
    transfer: as(
      admin,
      "aal2",
      `select public.admin_decide_claim('${claim}', 'approve', 'document_check', null)`,
    ),
  };
}

for (const first of ["transfer", "redemption"] as const)
  for (const commit of [true, false])
    it(`serialises invite redemption with a transfer (${first} first, ${commit ? "commit" : "rollback"})`, async () => {
      const f = fixture();
      const application = `invite-race-${randomUUID()}`;
      const [firstSql, secondSql] =
        first === "transfer" ? [f.transfer, f.accept] : [f.accept, f.transfer];
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

        const transferred =
          (first === "transfer" && commit) || first === "redemption";
        // A redemption waiting behind a committed transfer is refused, with the
        // same message as any other dead invite; every other order succeeds.
        if (first === "transfer" && commit) {
          expect(status).not.toBe(0);
          expect(two.errors()).toContain("invite_invalid");
        } else expect(status).toBe(0);

        const redeemed = first === "redemption" ? commit : !commit;
        const people =
          rows(`select user_id::text || ':' || role || ':' || status
          from public.memberships where organisation_id='${f.org}' order by user_id`);
        const expected = [
          `${f.owner}:owner:${transferred ? "revoked" : "active"}`,
          ...(transferred ? [`${f.claimant}:owner:active`] : []),
          // Access gained just before a transfer is revoked by it.
          ...(redeemed
            ? [`${f.invitee}:manager:${transferred ? "revoked" : "active"}`]
            : []),
        ].sort();
        expect(people).toEqual(expected);
        // Nobody displaced by the transfer keeps or regains active access.
        if (transferred)
          expect(
            rows(`select count(*) from public.memberships
              where organisation_id='${f.org}' and status='active' and user_id <> '${f.claimant}'`),
          ).toEqual(["0"]);
      } finally {
        one.child.kill();
        two.child.kill();
        await Promise.allSettled([one.done, two.done]);
      }
    });
