import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM,
  SCHEMAS,
  TRANSIENT_SECURITY_TABLES,
  assertManifestCovers,
  classify,
  inventorySql,
  migrationTables,
} from "./coverage.js";

const migrations = new URL("../../../supabase/migrations/", import.meta.url);

test("every app table is exported except the named transient security tables", () => {
  const tables = migrationTables(migrations.pathname);
  // Sanity: Phase 1, P2-1, P2-4, P2-5 and onboarding tables are all seen.
  for (const t of [
    "public.profiles",
    "public.audit_log",
    "private.platform_admins",
    "public.listings",
    "public.listing_claims",
    "public.claim_disputes",
    "public.consents",
    "public.enquiries",
    "public.demand_requests",
    "public.support_cases",
    "public.invites",
  ])
    assert.ok(tables.includes(t), t);
  const plan = classify(tables);
  assert.deepEqual(
    plan.export,
    tables.filter((t) => !TRANSIENT_SECURITY_TABLES.includes(t)),
  );
  assert.deepEqual(
    plan.ephemeral,
    tables.filter((t) => TRANSIENT_SECURITY_TABLES.includes(t)),
  );
  assert.deepEqual([...TRANSIENT_SECURITY_TABLES].sort(), [
    "private.mfa_email_challenges",
    "private.mfa_stepups",
    "private.primary_auth_receipts",
  ]);
});

test("an unclassified table fails the plan, naming it", () => {
  assert.throws(
    () => classify(["public.profiles", "auth.brand_new_table"]),
    /not covered by the backup plan: auth\.brand_new_table/,
  );
  assert.throws(() => classify(["graphql.something"]), /graphql\.something/);
});

test("ordinary app tables cannot be excluded by the platform plan", () => {
  // Even if someone lists a public table as ephemeral, it is exported.
  const plan = classify(["public.sessions", "private.cache"]);
  assert.deepEqual(plan.export, ["private.cache", "public.sessions"]);
  for (const table of Object.keys(PLATFORM))
    assert.ok(
      !["public", "private"].includes(table.split(".")[0]),
      `${table} must not be in the platform list`,
    );
});

test("platform classes are known and cover the auth and storage basics", () => {
  for (const [table, kind] of Object.entries(PLATFORM)) {
    assert.ok(SCHEMAS.includes(table.split(".")[0]), table);
    assert.ok(["export", "objects", "managed", "ephemeral"].includes(kind));
  }
  for (const t of ["auth.users", "auth.identities", "auth.mfa_factors"])
    assert.equal(PLATFORM[t], "export");
  assert.equal(PLATFORM["storage.objects"], "objects");
  assert.equal(PLATFORM["auth.refresh_tokens"], "ephemeral");
  assert.equal(PLATFORM["auth.sessions"], "ephemeral");
});

test("the manifest must hold exactly the exported and object tables", () => {
  const plan = classify([
    "public.a",
    "auth.users",
    "storage.objects",
    "auth.sessions",
  ]);
  assertManifestCovers(plan, {
    "public.a": {},
    "auth.users": {},
    "storage.objects": {},
  });
  assert.throws(
    () => assertManifestCovers(plan, { "public.a": {}, "auth.users": {} }),
    /Missing: storage\.objects/,
  );
  assert.throws(
    () =>
      assertManifestCovers(plan, {
        "public.a": {},
        "auth.users": {},
        "storage.objects": {},
        "auth.sessions": {},
      }),
    /unexpected: auth\.sessions/,
  );
});

test("migration parsing follows drops and renames", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = mkdtempSync(join(tmpdir(), "bk1-"));
  writeFileSync(
    join(dir, "1.sql"),
    "create table public.a (id int);\n-- create table public.commented (id int);\ncreate table if not exists private.b (id int);\ncreate table auth.ignored (id int);",
  );
  writeFileSync(
    join(dir, "2.sql"),
    'drop table if exists public.a;\nalter table private.b rename to c;\ncreate table public."d" (id int);',
  );
  assert.deepEqual(migrationTables(dir), ["private.c", "public.d"]);
});

test("inventory SQL is order-independent and quotes names", () => {
  assert.match(inventorySql("public.listings"), /order by to_jsonb\(t\)::text/);
  assert.match(inventorySql("public.listings"), /from "public"\."listings" t/);
  assert.doesNotMatch(
    inventorySql("storage.objects"),
    /\bversion\b|created_at/,
  );
});
