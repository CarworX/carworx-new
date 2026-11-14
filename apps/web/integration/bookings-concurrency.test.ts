import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { PASSWORD, admin, asUser, sql, sqlRows, stack } from "./harness";

// Phase 3 test round (P3-O2), A18: N + 1 concurrent holds on one interval of
// a resource with capacity N give exactly N holds. Two ways:
//  1. real database sessions held at a barrier: a leader locks the resource
//     row, all N + 1 acceptances are seen waiting on that lock, then the
//     leader commits and they race;
//  2. the same race through PostgREST with a signed-in owner's token.
// SYNTHETIC DATA ONLY.

function connection() {
  const flags = ["-XqAt", "-v", "ON_ERROR_STOP=1"];
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

async function until(check: () => boolean, what: string) {
  const deadline = Date.now() + 15_000;
  while (!check()) {
    if (Date.now() > deadline) throw Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
}

function waitingOnLock(prefix: string): number {
  const rows = sqlRows(
    `select count(*) from pg_stat_activity where application_name like '${prefix}%' and wait_event_type = 'Lock'`,
  );
  return Number(rows[0] ?? "0");
}

const ownerClaims = (owner: string) =>
  `{"sub":"${owner}","role":"authenticated","aal":"aal1"}`;

/**
 * One organisation with one bay of the given capacity, open 06:00-20:00 every
 * day, a fixed-price 60-minute offer, an owner, and `requests` customers who
 * each asked for the same 09:00 slot on a future ordinary weekday.
 */
function fixture(capacity: number, requests: number, ownerId?: string) {
  const id = () => randomUUID();
  const [org, listing, resource, offer] = [id(), id(), id(), id()];
  const owner = ownerId ?? id();
  const customers = Array.from({ length: requests }, id);
  const tag = org.slice(0, 8);
  const users = [
    ...(ownerId
      ? []
      : [`('${owner}', 'race-owner-${tag}@example.test', now())`]),
    ...customers.map(
      (c, i) => `('${c}', 'race-c${String(i)}-${tag}@example.test', now())`,
    ),
  ];
  sql(`
    insert into auth.users(id, email, email_confirmed_at) values ${users.join(", ")};
    insert into public.organisations(id, name) values ('${org}', 'Race Bays ${tag} (synthetic)');
    insert into public.memberships(organisation_id, user_id, role, status) values ('${org}', '${owner}', 'owner', 'active');
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      values ('${listing}', '${org}', 'mobile-repair', 'Race listing (synthetic)', 'Synthetic race fixture', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-race');
    insert into public.resources(id, organisation_id, kind, name, capacity) values ('${resource}', '${org}', 'bay', 'Race bay', ${String(capacity)});
    insert into public.resource_hours(resource_id, organisation_id, weekday, opens, closes)
      select '${resource}', '${org}', w, '06:00', '20:00' from generate_series(1, 7) w;
    insert into public.service_offers(id, organisation_id, listing_public_id, name, pricing, price_minor, duration_minutes, resource_kind)
      values ('${offer}', '${org}', '${listing}', 'Race wash', 'fixed', 25000, 60, 'bay');
  `);
  const bookings = customers.map(
    (c) =>
      sqlRows(`
        with claims as materialized (
          select set_config('request.jwt.claims', '{"sub":"${c}","role":"authenticated","aal":"aal1"}', true))
        select private.request_booking('${offer}', (
          select (d::date + time '09:00') at time zone 'Africa/Johannesburg'
          from generate_series(current_date + 14, current_date + 60, interval '1 day') d
          where not private.is_public_holiday(d::date) and extract(isodow from d) between 2 and 4
          order by d limit 1)) from claims;
      `)[0] ?? "",
  );
  return { org, owner, resource, bookings };
}

function activeHolds(resource: string): number {
  return Number(
    sqlRows(
      `select count(*) from public.reservations where resource_id = '${resource}' and state = 'active'`,
    )[0],
  );
}

describe("A18 capacity race at a lock barrier (real sessions)", () => {
  for (const capacity of [1, 3])
    it(`capacity ${String(capacity)}: ${String(capacity + 1)} concurrent acceptances give exactly ${String(capacity)} hold(s)`, async () => {
      const f = fixture(capacity, capacity + 1);
      expect(f.bookings.every((b) => /^[0-9a-f-]{36}$/.test(b))).toBe(true);
      const prefix = `bk-race-${randomUUID().slice(0, 8)}`;
      const leader = session();
      const racers = f.bookings.map(() => session());
      try {
        leader.child.stdin.write(
          `set statement_timeout = '20s'; begin; select 1 from public.resources where id = '${f.resource}' for update;\n\\echo LOCKED\n`,
        );
        await until(
          () => leader.output().includes("LOCKED"),
          "the leader lock",
        );
        racers.forEach((r, i) => {
          r.child.stdin.end(
            `set statement_timeout = '20s'; set application_name = '${prefix}-${String(i)}'; begin; set local role authenticated; set local request.jwt.claims = '${ownerClaims(f.owner)}'; select 'HOLD:' || public.accept_booking('${f.bookings[i] ?? ""}'); commit;\n`,
          );
        });
        await until(
          () => waitingOnLock(prefix) === racers.length,
          "every racer to wait on the resource lock",
        );
        leader.child.stdin.end("commit;\n");
        expect(await leader.done).toBe(0);
        const statuses = await Promise.all(racers.map((r) => r.done));
        const won = racers.filter((r) => r.output().includes("HOLD:")).length;
        const full = racers.filter((r) =>
          r.errors().includes("capacity_full"),
        ).length;
        expect({ won, full }).toEqual({ won: capacity, full: 1 });
        expect(statuses.filter((s) => s === 0)).toHaveLength(capacity);
        expect(activeHolds(f.resource)).toBe(capacity);
        expect(
          sqlRows(
            `select state, count(*) from public.bookings where organisation_id = '${f.org}' group by state order by state`,
          ),
        ).toEqual([`awaiting_payment|${String(capacity)}`, "requested|1"]);
      } finally {
        for (const s of [leader, ...racers]) s.child.kill();
      }
    });
});

describe("A18 capacity race through PostgREST", () => {
  it("capacity 2: three simultaneous accept_booking calls give exactly two holds", async () => {
    const email = `race-owner-${randomUUID().slice(0, 8)}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
    });
    if (created.error !== null) throw created.error;
    const f = fixture(2, 3, created.data.user.id);
    const anon = createClient(stack.apiUrl, stack.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signedIn = await anon.auth.signInWithPassword({
      email,
      password: PASSWORD,
    });
    if (signedIn.error !== null) throw signedIn.error;
    const db = asUser(signedIn.data.session.access_token);
    const results = await Promise.all(
      f.bookings.map((b) => db.rpc("accept_booking", { p_booking: b })),
    );
    expect(results.filter((r) => r.error === null)).toHaveLength(2);
    expect(
      results.flatMap((r) => (r.error === null ? [] : [r.error.message])),
    ).toEqual(["capacity_full"]);
    expect(activeHolds(f.resource)).toBe(2);
  });
});
