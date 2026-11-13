// BK-1 backup coverage. Every table in the backed-up schemas must be in
// exactly one class below, and every public or private table must be
// exported: there is no way to leave application data out. A table that is
// new (a migration, #84's onboarding tables, or a Supabase upgrade adding an
// auth/storage table) fails the drill and the unit test until it's classified
// here in a reviewed PR.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const SCHEMAS = [
  "public",
  "private",
  "auth",
  "storage",
  "supabase_migrations",
];
const APP_SCHEMAS = new Set(["public", "private"]);

/**
 * Platform tables outside public/private, by how the backup treats them.
 * export:    rows go into the data dump and are restored.
 * objects:   restored through the Storage API (bytes plus owner), not SQL.
 * managed:   the target stack writes them itself at start; compared
 *            separately (migration history) or rebuilt by the platform.
 * ephemeral: short-lived credentials or in-flight state. Left out by design,
 *            so a restore never revives old sessions or tokens; people sign
 *            in again.
 */
export const PLATFORM = {
  "auth.audit_log_entries": "export",
  "auth.custom_oauth_providers": "export",
  "auth.identities": "export",
  "auth.instances": "export",
  "auth.mfa_factors": "export",
  "auth.mfa_recovery_code_sets": "export",
  "auth.mfa_recovery_codes": "export",
  "auth.oauth_clients": "export",
  "auth.oauth_consents": "export",
  "auth.saml_providers": "export",
  "auth.scim_tokens": "export",
  "auth.scim_users": "export",
  "auth.sso_domains": "export",
  "auth.sso_providers": "export",
  "auth.users": "export",
  "auth.webauthn_credentials": "export",
  "auth.schema_migrations": "managed",
  "auth.flow_state": "ephemeral",
  "auth.mfa_amr_claims": "ephemeral",
  "auth.mfa_challenges": "ephemeral",
  "auth.oauth_authorizations": "ephemeral",
  "auth.oauth_client_states": "ephemeral",
  "auth.one_time_tokens": "ephemeral",
  "auth.refresh_tokens": "ephemeral",
  "auth.saml_relay_states": "ephemeral",
  "auth.sessions": "ephemeral",
  "auth.webauthn_challenges": "ephemeral",
  "storage.buckets": "export",
  "storage.buckets_analytics": "export",
  "storage.buckets_vectors": "export",
  "storage.iceberg_namespaces": "export",
  "storage.iceberg_tables": "export",
  "storage.vector_indexes": "export",
  "storage.objects": "objects",
  "storage.migrations": "managed",
  "storage.s3_multipart_uploads": "ephemeral",
  "storage.s3_multipart_uploads_parts": "ephemeral",
  "supabase_migrations.schema_migrations": "managed",
  "supabase_migrations.seed_files": "managed",
};

/** Every base or partitioned table in the backed-up schemas. */
export const DISCOVER_TABLES_SQL = `select coalesce(jsonb_agg(n.nspname || '.' || c.relname order by 1), '[]')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind in ('r', 'p') and not c.relispartition
    and n.nspname in (${SCHEMAS.map((s) => `'${s}'`).join(", ")});`;

/** Every sequence in the backed-up schemas (its value is part of the data). */
export const DISCOVER_SEQUENCES_SQL = `select coalesce(jsonb_agg(n.nspname || '.' || c.relname order by 1), '[]')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'S' and n.nspname in (${SCHEMAS.map((s) => `'${s}'`).join(", ")});`;

/**
 * Splits discovered tables into classes. Throws, naming the tables, if any
 * is unclassified or if an app table is anything but exported.
 */
export function classify(tables) {
  const plan = { export: [], objects: [], managed: [], ephemeral: [] };
  const unknown = [];
  for (const table of [...new Set(tables)].sort()) {
    const schema = table.split(".")[0];
    if (!SCHEMAS.includes(schema)) unknown.push(table);
    else if (APP_SCHEMAS.has(schema)) plan.export.push(table);
    else if (PLATFORM[table]) plan[PLATFORM[table]].push(table);
    else unknown.push(table);
  }
  if (unknown.length > 0)
    throw new Error(
      "BK-1: tables not covered by the backup plan: " + unknown.join(", "),
    );
  return plan;
}

/** The manifest must hold an inventory for exactly the exported tables. */
export function assertManifestCovers(plan, manifestTables) {
  const want = [...plan.export, ...plan.objects].sort();
  const have = Object.keys(manifestTables).sort();
  const missing = want.filter((t) => !have.includes(t));
  const extra = have.filter((t) => !want.includes(t));
  if (missing.length > 0 || extra.length > 0)
    throw new Error(
      "BK-1: manifest does not match the plan. Missing: " +
        (missing.join(", ") || "none") +
        "; unexpected: " +
        (extra.join(", ") || "none"),
    );
}

/**
 * Public and private tables the migrations create and keep, read from the
 * SQL text (no database needed). Used to prove the classifier sees every
 * application table even before a stack starts.
 */
export function migrationTables(migrationsDir) {
  const tables = new Set();
  const name = String.raw`(?:"?(public|private)"?)\."?([a-z_][a-z0-9_]*)"?`;
  const create = new RegExp(
    String.raw`create\s+table\s+(?:if\s+not\s+exists\s+)?` + name,
    "gi",
  );
  const drop = new RegExp(
    String.raw`drop\s+table\s+(?:if\s+exists\s+)?` + name,
    "gi",
  );
  const rename = new RegExp(
    String.raw`alter\s+table\s+(?:if\s+exists\s+)?` +
      name +
      String.raw`\s+rename\s+to\s+"?([a-z_][a-z0-9_]*)"?`,
    "gi",
  );
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    const text = readFileSync(join(migrationsDir, file), "utf8").replace(
      /--[^\n]*/g,
      "",
    );
    const events = [];
    for (const m of text.matchAll(create))
      events.push([m.index, "add", `${m[1]}.${m[2]}`.toLowerCase()]);
    for (const m of text.matchAll(drop))
      events.push([m.index, "drop", `${m[1]}.${m[2]}`.toLowerCase()]);
    for (const m of text.matchAll(rename))
      events.push([
        m.index,
        "rename",
        `${m[1]}.${m[2]}`.toLowerCase(),
        `${m[1]}.${m[3]}`.toLowerCase(),
      ]);
    for (const [, kind, table, to] of events.sort((a, b) => a[0] - b[0])) {
      if (kind === "add") tables.add(table);
      else if (kind === "drop") tables.delete(table);
      else if (tables.delete(table)) tables.add(to);
    }
  }
  return [...tables].sort();
}

/**
 * A deterministic per-table inventory statement: row count and a hash input
 * that doesn't depend on physical row order. storage.objects is compared on
 * the columns a restore must keep (ids, versions and timestamps change when
 * the bytes are uploaded again).
 */
export function inventorySql(table) {
  if (table === "storage.objects")
    return `select coalesce(jsonb_agg(r order by r::text), '[]') from (
      select jsonb_build_object('bucket_id', bucket_id, 'name', name, 'owner_id', owner_id,
        'user_metadata', user_metadata, 'size', metadata->>'size', 'mimetype', metadata->>'mimetype') r
      from storage.objects) s;`;
  const [schema, name] = table.split(".");
  return `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from "${schema}"."${name}" t;`;
}
