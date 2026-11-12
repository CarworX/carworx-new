import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  readdirSync,
  statfsSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { validateTap } from "../../ci/core.js";
import {
  databaseDiagnostic,
  rlsFailureSummary,
} from "../../ci/database-diagnostic.js";

process.umask(0o077);
const [repo, revision, pgBin, mode] = process.argv.slice(2);
assert.match(revision ?? "", /^[a-f0-9]{40}$/);
assert.ok(mode === undefined || mode === "--ci");
const ci = mode === "--ci";
if (ci) {
  assert.equal(process.platform, "linux");
  assert.equal(process.env.GITHUB_ACTIONS, "true");
  assert.ok(process.env.RUNNER_TEMP?.startsWith("/"));
} else {
  assert.equal(process.env.WSL_DISTRO_NAME, "CarworX-Native");
  assert.equal(process.env.USER, "carworx");
}
const runtime = ci ? "docker" : "native";
const workspace = ci ? process.env.RUNNER_TEMP : homedir();
const cli = ci
  ? join(repo, "node_modules/.bin/supabase")
  : join(homedir(), "bin/supabase");
const root = mkdtempSync(join(workspace, "k4-drill-"));
const bundle = join(root, "bundle");
mkdirSync(bundle);
const env = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) => !/^(?:SUPABASE_|PG)/.test(name),
  ),
);
env.SUPABASE_EXPERIMENTAL_STACK = ci ? "0" : "1";
env.PATH = pgBin + ":" + process.env.PATH;
const tables = [
  "auth.users",
  "auth.identities",
  "auth.mfa_factors",
  "public.profiles",
  "public.organisations",
  "public.memberships",
  "public.audit_log",
  "private.platform_admins",
  "private.mail_outbox",
  "private.mail_delivery_events",
];
const bucket = "k4-private";
const files = ["tenant-a.bin", "tenant-b.bin"];
const objects = files.map((name, index) => ({ name, path: "object-" + index }));
const password = randomBytes(24).toString("hex") + "Aa!";
const addresses = ["member-a", "member-b", "revoked", "admin"].map(
  (name) => name + "@example.test",
);
const [orgA, orgB] = [randomUUID(), randomUUID()];
const sha = (data) => createHash("sha256").update(data).digest("hex");
const gib = 1024 ** 3;

function freeBytes() {
  const disk = statfsSync(ci ? workspace : "/mnt/c");
  return disk.bavail * disk.bsize;
}

function capacity(minimum) {
  assert.ok(freeBytes() >= minimum, "Recovery disk safety margin reached");
}

let stageName = "preflight";
let diagnostic = "assertion";
function run(stage, command, args, options = {}) {
  stageName = stage;
  diagnostic = "assertion";
  const result = spawnSync(command, args, {
    env,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    timeout: 240_000,
    ...options,
  });
  writeFileSync(join(root, stage + ".log"), result.stderr ?? "");
  if (result.status !== 0) {
    const database = databaseDiagnostic(result);
    console.error(
      `Safe RLS metadata: ${JSON.stringify(rlsFailureSummary(result))}`,
    );
    diagnostic = /no space|ENOSPC/i.test(result.stderr ?? "")
      ? "capacity"
      : /address already in use|port.*allocat/i.test(result.stderr ?? "")
        ? "port"
        : /permission denied|access denied/i.test(result.stderr ?? "")
          ? "permission"
          : /docker/i.test(result.stderr ?? "")
            ? "docker-command"
            : /supabase|postgres/i.test(result.stderr ?? "")
              ? "stack-command"
              : "command";
    if (database !== "unclassified") diagnostic = database;
    throw Error(stage + " failed (private log in " + root + ")");
  }
  return result.stdout;
}

function safePort(value, protocol) {
  const url = new URL(value);
  assert.equal(url.protocol, protocol);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname));
  assert.ok(Number(url.port) >= 20000 && Number(url.port) <= 32767);
  assert.ok(!["54321", "54322", "54323", "54324", "54327"].includes(url.port));
  return url.port;
}

function stack(name) {
  const cwd = join(root, name);
  mkdirSync(cwd);
  cpSync(join(repo, "supabase"), join(cwd, "supabase"), { recursive: true });
  const config = join(cwd, "supabase/config.toml");
  const text = readFileSync(config, "utf8").replace(/\r/g, "");
  let port = name === "source" ? 25000 : 26000;
  const local = text
    .replace(
      /^\[auth\.email\.template\.(?:confirmation|recovery)\]\n[\s\S]*?(?=^\[|$(?![\s\S]))/gm,
      "",
    )
    .replace(/^(port|shadow_port|inspector_port) = .*\n/gm, (_, key) =>
      ci ? key + " = " + String(port++) + "\n" : "",
    )
    .replace(
      /(^\[db\.seed\]\n(?:#[^\n]*\n)*)enabled = true/m,
      "$1enabled = false",
    );
  assert.ok(!/^content_path =/m.test(local));
  assert.match(local, /\[db\.seed\]\n(?:#[^\n]*\n)*enabled = false/);
  const project = ci
    ? local.replace(
        /^project_id = .*$/m,
        `project_id = "carworx-k4-${name}-${randomUUID().slice(0, 8)}"`,
      )
    : local;
  writeFileSync(config, project);
  return { name, cwd };
}

function start(instance) {
  stageName = instance.name + "-capacity";
  capacity(2 * gib);
  const { name, cwd } = instance;
  let config;
  if (ci) {
    run(name + "-start", cli, ["start"], { cwd });
    const status = run(name + "-status", cli, ["status", "-o", "json"], {
      cwd,
    });
    config = JSON.parse(status.slice(status.indexOf("{")));
  } else {
    const result = JSON.parse(
      run(
        name + "-start",
        cli,
        [
          "start",
          "--stack",
          name,
          "--runtime",
          "native",
          "--preparation",
          "on-demand",
          "--output-format",
          "json",
        ],
        { cwd },
      ),
    );
    assert.equal(result.runtime, "native");
    config = result.env;
  }
  safePort(config.API_URL, "http:");
  safePort(config.DB_URL, "postgresql:");
  return config;
}

function stop(instance) {
  run(
    instance.name + "-stop",
    cli,
    ci ? ["stop", "--no-backup"] : ["stop", "--stack", instance.name],
    {
      cwd: instance.cwd,
    },
  );
}

async function api(config, path, { method = "GET", token, body } = {}) {
  const key = token ?? config.SERVICE_ROLE_KEY;
  const response = await fetch(new URL(path, config.API_URL), {
    method,
    headers: {
      apikey: token ? config.ANON_KEY : config.SERVICE_ROLE_KEY,
      Authorization: "Bearer " + key,
      "Content-Type": Buffer.isBuffer(body)
        ? "application/octet-stream"
        : "application/json",
    },
    body: Buffer.isBuffer(body) ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  return response;
}

async function ok(response, stage) {
  if (!response.ok) throw Error(stage + " HTTP " + response.status);
  return response;
}

function sql(config, stage, statement) {
  return run(stage, "psql", ["-XAtq", "-v", "ON_ERROR_STOP=1", config.DB_URL], {
    input: statement,
  }).trim();
}

function inventory(config) {
  return Object.fromEntries(
    tables.map((table) => {
      const order =
        table === "private.platform_admins"
          ? "user_id"
          : table === "private.mail_delivery_events"
            ? "provider_id"
            : "id";
      const rows = sql(
        config,
        "inventory-" + table,
        "select coalesce(jsonb_agg(to_jsonb(t) order by " +
          order +
          "), '[]') from " +
          table +
          " t;",
      );
      return [table, { count: JSON.parse(rows).length, sha256: sha(rows) }];
    }),
  );
}

function schema(config) {
  const dump = run("schema", "pg_dump", [
    "--schema-only",
    ...["public", "private", "auth", "storage", "supabase_migrations"].flatMap(
      (name) => ["-n", name],
    ),
    config.DB_URL,
  ]);
  const roles = sql(
    config,
    "roles",
    "select rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls from pg_roles order by rolname; select roleid::regrole, member::regrole, admin_option, inherit_option, set_option from pg_auth_members order by 1, 2;",
  );
  return dump.replace(/^\\(?:un)?restrict .*\n/gm, "") + roles;
}

async function signIn(config, index) {
  const response = await ok(
    await api(config, "/auth/v1/token?grant_type=password", {
      method: "POST",
      token: config.ANON_KEY,
      body: { email: addresses[index], password },
    }),
    "password sign-in",
  );
  return (await response.json()).access_token;
}

function otp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "")]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(bits.match(/.{8}/g).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", key).update(counter).digest();
  return String(
    (digest.readUInt32BE(digest[19] & 15) & 0x7fffffff) % 1_000_000,
  ).padStart(6, "0");
}

async function elevate(config, token, factor, secret) {
  const base = "/auth/v1/factors/" + factor;
  const challenge = await ok(
    await api(config, base + "/challenge", { method: "POST", token, body: {} }),
    "MFA challenge",
  );
  const verified = await ok(
    await api(config, base + "/verify", {
      method: "POST",
      token,
      body: { challenge_id: (await challenge.json()).id, code: otp(secret) },
    }),
    "MFA verify",
  );
  return (await verified.json()).access_token;
}

const objectPath = (name) => "/storage/v1/object/" + bucket + "/" + name;

async function putObjects(config, payloads) {
  await ok(
    await api(config, "/storage/v1/bucket", {
      method: "POST",
      body: { id: bucket, name: bucket, public: false },
    }),
    "create private bucket",
  );
  for (const [index, object] of objects.entries()) {
    await ok(
      await api(config, objectPath(object.name), {
        method: "POST",
        token: await signIn(config, index),
        body: payloads[index],
      }),
      "upload private object",
    );
  }
}

async function getObject(config, name, token) {
  const result = await ok(
    await api(config, objectPath(name), { token }),
    "download private object",
  );
  return Buffer.from(await result.arrayBuffer());
}

function validate(manifest, read) {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.complete, true);
  assert.deepEqual(
    Object.keys(manifest.payloads).sort(),
    [
      "database.dump",
      "schema.txt",
      "baseline.json",
      "object-0",
      "object-1",
    ].sort(),
  );
  for (const [name, expected] of Object.entries(manifest.payloads)) {
    const bytes = read(name);
    assert.equal(bytes.length, expected.bytes);
    assert.equal(sha(bytes), expected.sha256);
  }
}

function negativeTests(manifest, read) {
  assert.throws(() => validate({ ...manifest, complete: false }, read));
  assert.throws(() =>
    validate(manifest, (name) =>
      name === "object-0" ? Buffer.from("bad") : read(name),
    ),
  );
  assert.throws(() =>
    validate(manifest, (name) => {
      if (name === "object-1") throw Error("missing object");
      return read(name);
    }),
  );
  for (const url of [
    "http://localhost:54321",
    "http://example.test:23456",
    "https://127.0.0.1:23456",
  ]) {
    assert.throws(() => safePort(url, "http:"));
  }
}

async function seed(config) {
  const users = [];
  for (const email of addresses) {
    const response = await ok(
      await api(config, "/auth/v1/admin/users", {
        method: "POST",
        body: { email, password, email_confirm: true },
      }),
      "create synthetic user",
    );
    const { id } = await response.json();
    assert.match(id, /^[a-f0-9-]{36}$/);
    users.push(id);
  }
  const [a, b, revoked, admin] = users;
  sql(
    config,
    "seed",
    `
    insert into public.profiles (id, display_name) values ${users.map((id, index) => "('" + id + "', 'K4 user " + index + "')").join(",")};
    insert into public.organisations (id, name) values ('${orgA}', 'K4 A'), ('${orgB}', 'K4 B');
    insert into public.memberships (organisation_id, user_id, role, status) values
      ('${orgA}', '${a}', 'owner', 'active'), ('${orgB}', '${b}', 'owner', 'active'),
      ('${orgA}', '${revoked}', 'staff', 'revoked');
    insert into private.platform_admins (user_id) values ('${admin}');
  `,
  );
  const token = await signIn(config, 3);
  const enrolled = await ok(
    await api(config, "/auth/v1/factors", {
      method: "POST",
      token,
      body: { factor_type: "totp", friendly_name: "K4 fixture" },
    }),
    "MFA enroll",
  );
  const {
    id,
    totp: { secret },
  } = await enrolled.json();
  await elevate(config, token, id, secret);
  await putObjects(
    config,
    files.map(() => randomBytes(1024)),
  );
  return { id, secret, users };
}

function storagePolicy(config) {
  sql(
    config,
    "storage-policy",
    `
    create policy k4_owner_select on storage.objects for select to authenticated
      using (bucket_id = '${bucket}' and owner_id = (select auth.uid())::text);
    create policy k4_member_insert on storage.objects for insert to authenticated
      with check (bucket_id = '${bucket}' and exists (
        select 1 from public.memberships where user_id = (select auth.uid()) and status = 'active'
      ));
  `,
  );
}

async function verify(config, factor, read) {
  const ids = async (token) =>
    (
      await (
        await ok(
          await api(config, "/rest/v1/organisations?select=id&order=id", {
            token,
          }),
          "tenant read",
        )
      ).json()
    ).map(({ id }) => id);
  const a = await signIn(config, 0);
  const b = await signIn(config, 1);
  assert.deepEqual(await ids(a), [orgA]);
  assert.deepEqual(await ids(b), [orgB]);
  assert.deepEqual(await ids(await signIn(config, 2)), []);
  const denied = await api(config, "/rest/v1/organisations?id=eq." + orgB, {
    method: "PATCH",
    token: a,
    body: { name: "K4 forbidden" },
  });
  assert.ok(denied.ok || [401, 403].includes(denied.status));
  assert.equal(
    sql(
      config,
      "cross-tenant-write",
      "select name from public.organisations where id = '" + orgB + "';",
    ),
    "K4 B",
  );
  const admin = await signIn(config, 3);
  assert.deepEqual(await ids(admin), []);
  assert.deepEqual(
    await ids(await elevate(config, admin, factor.id, factor.secret)),
    [orgA, orgB].sort(),
  );
  for (const [index, object] of objects.entries()) {
    const token = [a, b][index];
    assert.equal(
      sha(await getObject(config, object.name, token)),
      sha(read(object.path)),
    );
    assert.equal(
      sql(
        config,
        "object-owner",
        "select owner_id from storage.objects where bucket_id = '" +
          bucket +
          "' and name = '" +
          object.name +
          "';",
      ),
      factor.users[index],
    );
    for (const deniedToken of [[b, a][index], config.ANON_KEY]) {
      const response = await api(config, objectPath(object.name), {
        token: deniedToken,
      });
      assert.ok(
        [400, 401, 403, 404].includes(response.status),
        "private object access was not denied",
      );
    }
  }
  assert.equal(
    sql(
      config,
      "bucket-settings",
      "select public from storage.buckets where id = '" + bucket + "';",
    ),
    "f",
  );
}

async function drill() {
  assert.equal(run("cli-version", cli, ["--version"]).trim(), "2.122.1");
  for (const tool of ["pg_dump", "pg_restore", "psql"]) {
    assert.match(run(tool + "-version", tool, ["--version"]), /\b17\./);
  }
  capacity(7 * gib);
  const freeAtStart = freeBytes();
  const source = stack("source");
  const target = stack("target");
  let active;
  try {
    active = source;
    const origin = start(source);
    assert.equal(
      sql(origin, "source-empty", "select count(*) from auth.users;"),
      "0",
    );
    storagePolicy(origin);
    const factor = await seed(origin);
    const exportStart = new Date();
    const read = (name) => readFileSync(join(bundle, name));
    const manifest = {
      version: 1,
      complete: true,
      revision,
      cli: "2.122.1",
      postgres: sql(origin, "server-version", "show server_version;"),
      exportStarted: exportStart.toISOString(),
      payloads: {},
    };
    const migrationHistory = (config) =>
      sql(
        config,
        "migration-history",
        "select coalesce(jsonb_agg(to_jsonb(t) order by version), '[]') from supabase_migrations.schema_migrations t;",
      );
    const migrations = migrationHistory(origin);
    assert.notEqual(migrations, "[]");
    manifest.migrations = {
      sha256: sha(migrations),
      count: JSON.parse(migrations).length,
    };
    manifest.tables = inventory(origin);
    writeFileSync(join(bundle, "schema.txt"), schema(origin));
    const baseline = (instance) => {
      const directory = join(instance.cwd, "supabase");
      const paths = [
        "config.toml",
        ...readdirSync(join(directory, "migrations"))
          .sort()
          .map((name) => "migrations/" + name),
      ];
      return JSON.stringify(
        Object.fromEntries(
          paths.map((path) => [
            path,
            path === "config.toml" && ci
              ? readFileSync(join(directory, path), "utf8")
                  .replace(/^project_id = .*$/m, 'project_id = "carworx-k4"')
                  .replace(/^(?:port|shadow_port|inspector_port) = .*\n/gm, "")
              : readFileSync(join(directory, path), "utf8"),
          ]),
        ),
      );
    };
    writeFileSync(join(bundle, "baseline.json"), baseline(source));
    manifest.bucket = JSON.parse(
      sql(
        origin,
        "export-bucket",
        "select jsonb_build_object('id', id, 'public', public, 'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types) from storage.buckets where id = 'k4-private';",
      ),
    );
    manifest.objects = objects.map((object) => ({
      ...object,
      version:
        sql(
          origin,
          "object-version",
          "select version from storage.objects where bucket_id = 'k4-private' and name = '" +
            object.name +
            "';",
        ) || null,
    }));
    run("export", "pg_dump", [
      "--format=custom",
      "--data-only",
      ...tables.flatMap((table) => ["-t", table]),
      "-t",
      "public.audit_log_id_seq",
      "-f",
      join(bundle, "database.dump"),
      origin.DB_URL,
    ]);
    for (const object of objects)
      writeFileSync(
        join(bundle, object.path),
        await getObject(origin, object.name),
      );
    for (const name of [
      "schema.txt",
      "baseline.json",
      "database.dump",
      ...objects.map(({ path }) => path),
    ]) {
      const bytes = read(name);
      manifest.payloads[name] = { bytes: bytes.length, sha256: sha(bytes) };
    }
    manifest.exportFinished = new Date().toISOString();
    validate(manifest, read);
    writeFileSync(
      join(bundle, "manifest.tmp"),
      JSON.stringify(manifest, null, 2),
    );
    renameSync(join(bundle, "manifest.tmp"), join(bundle, "manifest.json"));
    negativeTests(manifest, read);
    stop(source);
    active = undefined;

    const restoreStart = Date.now();
    stageName = "restore-manifest";
    validate(JSON.parse(read("manifest.json")), read);
    assert.equal(
      sha(baseline(target)),
      manifest.payloads["baseline.json"].sha256,
    );
    active = target;
    const restored = start(target);
    for (const key of ["API_URL", "DB_URL"])
      assert.notEqual(new URL(restored[key]).port, new URL(origin[key]).port);
    assert.equal(
      sql(restored, "target-empty", "select count(*) from auth.users;"),
      "0",
    );
    storagePolicy(restored);
    assert.equal(sha(schema(restored)), manifest.payloads["schema.txt"].sha256);
    assert.equal(sha(migrationHistory(restored)), manifest.migrations.sha256);
    assert.throws(
      () =>
        run("injected-restore-failure", "pg_restore", [
          "--file=-",
          join(bundle, "schema.txt"),
        ]),
      /injected-restore-failure failed/,
    );
    assert.equal(
      sql(restored, "target-after-failure", "select count(*) from auth.users;"),
      "0",
    );
    const dataSql = run("decode-archive", "pg_restore", [
      "--data-only",
      "--file=-",
      join(bundle, "database.dump"),
    ]);
    const restoreFile = join(root, "restore.sql");
    writeFileSync(restoreFile, dataSql);
    // The local DB login cannot disable managed Auth triggers. Only suspend
    // app audit generation while replaying the original audit rows, and the
    // O2 control-generation trigger, which would otherwise bump the restored
    // organisations.control_generation as each owner membership is replayed.
    run("restore", "psql", [
      "-Xq",
      "--single-transaction",
      "-v",
      "ON_ERROR_STOP=1",
      restored.DB_URL,
      "-c",
      "alter table public.organisations disable trigger organisations_audit; alter table public.memberships disable trigger memberships_audit; alter table public.memberships disable trigger memberships_control_generation;",
      "-f",
      restoreFile,
      "-c",
      "alter table public.organisations enable trigger organisations_audit; alter table public.memberships enable trigger memberships_audit; alter table public.memberships enable trigger memberships_control_generation;",
    ]);
    assert.deepEqual(inventory(restored), manifest.tables);
    assert.equal(sha(schema(restored)), manifest.payloads["schema.txt"].sha256);
    await putObjects(
      restored,
      objects.map(({ path }) => read(path)),
    );
    await verify(restored, factor, read);
    assert.deepEqual(
      JSON.parse(
        sql(
          restored,
          "restore-bucket",
          "select jsonb_build_object('id', id, 'public', public, 'file_size_limit', file_size_limit, 'allowed_mime_types', allowed_mime_types) from storage.buckets where id = 'k4-private';",
        ),
      ),
      manifest.bucket,
    );
    const tapDir = join(root, "tap");
    run(
      "rls",
      process.execPath,
      [join(target.cwd, "supabase/tests/run-rls.js")],
      {
        env: { ...env, RLS_DB_URL: restored.DB_URL, CI_RLS_REPORT_DIR: tapDir },
      },
    );
    const reports = (path, suffix) =>
      readdirSync(path, { recursive: true })
        .filter((name) => name.endsWith(suffix))
        .sort();
    const expected = reports(
      join(target.cwd, "supabase/tests/database"),
      ".test.sql",
    ).map((name) => name + ".tap");
    assert.ok(expected.length > 0);
    assert.deepEqual(reports(tapDir, ".tap"), expected);
    const assertions = expected.reduce(
      (sum, name) =>
        sum + validateTap(readFileSync(join(tapDir, name), "utf8")).passed,
      0,
    );
    assert.ok(assertions > 0);
    stop(target);
    active = undefined;
    return {
      version: 1,
      status: "passed",
      revision,
      runtime,
      rlsAssertions: assertions,
      privateObjects: objects.length,
      tenantRecords: manifest.tables["public.organisations"].count,
      authIdentities: manifest.tables["auth.identities"].count,
      exportMs: Date.parse(manifest.exportFinished) - exportStart.getTime(),
      restoreAndVerifyMs: Date.now() - restoreStart,
      payloadBytes: Object.values(manifest.payloads).reduce(
        (sum, file) => sum + file.bytes,
        0,
      ),
      hostFreeBytesBefore: freeAtStart,
      hostFreeBytesAfter: freeBytes(),
      negativeChecks: 7,
    };
  } finally {
    if (active) {
      const failedStage = stageName;
      const failedReason = diagnostic;
      try {
        stop(active);
      } catch {
        console.error(
          "Cleanup also failed for " + active.name + " under " + root,
        );
      } finally {
        stageName = failedStage;
        diagnostic = failedReason;
      }
    }
  }
}

try {
  console.log(JSON.stringify(await drill()));
} catch (error) {
  // Assertion values and HTTP response bodies can contain private data.
  writeFileSync(join(root, "failure.log"), String(error.stack));
  console.error(
    "K4 drill failed at " +
      stageName +
      " (" +
      diagnostic +
      "). Private diagnostics: " +
      root,
  );
  process.exitCode = 1;
}
