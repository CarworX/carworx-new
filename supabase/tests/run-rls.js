// Runs every pgTAP file in supabase/tests/database against the local Supabase
// database and writes each file's raw TAP output to
// "$CI_RLS_REPORT_DIR/<relative sql name>.tap" (K1 contract, scripts/ci/README.md).
//
// The TAP is exactly what psql printed for that file; nothing is added or
// rewritten. The process exits nonzero if psql fails, a plan is missing,
// any assertion fails or is skipped, or the assertion count differs from the
// plan.
//
// Connection: RLS_DB_URL if set, otherwise DB_URL from `supabase status`.
// psql runs on the host if it exists, else inside the local database container.
// The URL is never printed (it carries the local stack's password).
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const sqlRoot = join(root, "supabase", "tests", "database");

function die(message) {
  console.error(`test:rls: ${message}`);
  process.exit(1);
}

function sqlFiles(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sqlFiles(path);
      return name.endsWith(".sql") ? [path] : [];
    });
}

function databaseUrl() {
  if (process.env.RLS_DB_URL) return process.env.RLS_DB_URL;
  const cli = join(root, "node_modules", ".bin", "supabase");
  const status = spawnSync(cli, ["status", "-o", "json"], {
    cwd: root,
    encoding: "utf8",
  });
  if (status.status !== 0) die("`supabase status` failed; is it started?");
  const start = status.stdout.indexOf("{");
  let parsed;
  try {
    parsed = JSON.parse(status.stdout.slice(start));
  } catch {
    die("could not parse `supabase status -o json` output");
  }
  if (typeof parsed.DB_URL !== "string") die("no DB_URL in supabase status");
  return parsed.DB_URL;
}

const psqlArgs = ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"];

function psqlCommand(url) {
  const hostPsql = spawnSync("psql", ["--version"], { encoding: "utf8" });
  if (hostPsql.status === 0) return ["psql", [...psqlArgs, url]];
  // Fall back to the psql inside the database container, where the server
  // listens on 5432 instead of the mapped host port.
  const config = readFileSync(join(root, "supabase", "config.toml"), "utf8");
  const projectId = /^project_id\s*=\s*"([^"]+)"/m.exec(config)?.[1];
  if (!projectId) die("project_id missing from supabase/config.toml");
  const inner = new URL(url);
  inner.hostname = "127.0.0.1";
  inner.port = "5432";
  return [
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${projectId}`,
      "psql",
      ...psqlArgs,
      inner.toString(),
    ],
  ];
}

function check(tap) {
  const problems = [];
  let planned;
  const numbers = [];
  for (const line of tap.split(/\r?\n/).map((s) => s.trim())) {
    if (line === "" || line.startsWith("#")) continue;
    if (/^Bail out!/i.test(line)) problems.push(line);
    const plan = /^1\.\.(\d+)(.*)$/.exec(line);
    if (plan) {
      if (planned !== undefined || /#\s*(SKIP|TODO)/i.test(plan[2]))
        problems.push(`bad plan: ${line}`);
      planned = Number(plan[1]);
      continue;
    }
    const assertion = /^(not ok|ok)\s+(\d+)\b(.*)$/.exec(line);
    if (!assertion) {
      problems.push(`not TAP: ${line}`);
      continue;
    }
    if (assertion[1] !== "ok" || /#\s*(SKIP|TODO)/i.test(assertion[3]))
      problems.push(line);
    numbers.push(Number(assertion[2]));
  }
  if (!(planned > 0)) problems.push("no plan");
  else if (numbers.length !== planned || !numbers.every((n, i) => n === i + 1))
    problems.push(`ran ${String(numbers.length)} of ${String(planned)}`);
  return { planned, problems };
}

const reportDir = process.env.CI_RLS_REPORT_DIR;
if (!reportDir || !isAbsolute(reportDir))
  die("CI_RLS_REPORT_DIR must be an absolute path");

const files = sqlFiles(sqlRoot);
if (files.length === 0) die(`no SQL files under ${relative(root, sqlRoot)}`);

const [command, args] = psqlCommand(databaseUrl());
let failed = false;

for (const file of files) {
  const name = relative(sqlRoot, file);
  const result = spawnSync(command, args, {
    input: readFileSync(file, "utf8"),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const tap = result.stdout;
  const out = join(reportDir, `${name}.tap`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, tap);

  const { planned, problems } = check(tap);
  if (result.status !== 0)
    problems.unshift(`psql exited ${String(result.status)}`);
  if (problems.length === 0) {
    console.log(`ok   ${name} (${String(planned)} assertions)`);
  } else {
    failed = true;
    console.log(`FAIL ${name}`);
    for (const p of problems) console.log(`     ${p}`);
    const errors = result.stderr
      .split("\n")
      .filter((l) => /ERROR|FATAL/.test(l));
    for (const e of errors) console.log(`     ${e}`);
  }
}

process.exit(failed ? 1 : 0);
