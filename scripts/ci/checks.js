import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  command,
  context,
  evidencePath,
  invariant,
  outputSummary,
  readJson,
  suiteContract,
  validateTap,
  validateVitest,
  writeEvidence,
} from "./core.js";

const statePath = () => evidencePath("checks");
const save = (state) => writeEvidence("checks", state);

function filesUnder(path, suffix) {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = join(path, entry.name);
    return entry.isDirectory()
      ? filesUnder(child, suffix)
      : child.endsWith(suffix)
        ? [child]
        : [];
  });
}

function record(name, action) {
  const state = readJson(statePath());
  try {
    state.checks[name] = { status: "passed", ...action() };
  } catch (error) {
    state.checks[name] = { status: "failed" };
    throw error;
  } finally {
    save(state);
  }
}

function initialize() {
  const ctx = context();
  const state = {
    context: ctx,
    status: "incomplete",
    checks: {},
    contract: suiteContract(ctx.base_sha),
  };
  save(state);
  invariant(
    process.version.slice(1) === readFileSync(".node-version", "utf8").trim(),
    "Node differs from scaffold pin",
  );
  const version = command("pnpm", ["--version"], {
    encoding: "utf8",
    stdio: "pipe",
  }).stdout.trim();
  invariant(
    `pnpm@${version}` === readJson("package.json").packageManager,
    "pnpm differs from scaffold pin",
  );
  state.context.pnpm = version;
  for (const suite of ["rls", "integration"]) {
    if (state.contract[suite]) {
      invariant(
        typeof readJson("package.json").scripts?.[`test:${suite}`] === "string",
        `Missing test:${suite} command`,
      );
    } else {
      state.checks[suite] = {
        status: "not_applicable",
        reason:
          suite === "rls"
            ? "T2 schema not introduced"
            : "T3/T5 Auth and security not introduced",
      };
    }
  }
  save(state);
}

function runUnit() {
  // T1 has one test workspace. Fail instead of overwriting reports when that changes.
  const workspaces = readdirSync("apps", { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter(
      (d) =>
        existsSync(join("apps", d.name, "package.json")) &&
        readJson(join("apps", d.name, "package.json")).scripts?.test,
    );
  invariant(
    workspaces.length === 1 && workspaces[0].name === "web",
    "New test workspaces require individual report contracts",
  );
  const path = join(process.env.RUNNER_TEMP, "k1-unit-private.json");
  invariant(!existsSync(path), "Refusing a stale unit report");
  command("pnpm", [
    "run",
    "test",
    "--reporter=default",
    "--reporter=json",
    `--outputFile=${path}`,
  ]);
  return validateVitest(readJson(path));
}

function runFuture() {
  const { contract } = readJson(statePath());
  if (!contract.rls && !contract.integration) return;
  const pkg = readJson("package.json");
  invariant(
    /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(
      pkg.devDependencies?.supabase ?? pkg.dependencies?.supabase ?? "",
    ),
    "T2 must pin the Supabase CLI exactly",
  );
  const privateRoot = join(process.env.RUNNER_TEMP, "k1-future-private");
  invariant(!existsSync(privateRoot), "Refusing stale future-suite reports");
  mkdirSync(privateRoot);
  const quiet = { stdio: "pipe", encoding: "utf8" };
  // Supabase prints local keys. Keep all service output private and ephemeral.
  try {
    command("pnpm", ["exec", "supabase", "start"], quiet);
    command("pnpm", ["exec", "supabase", "db", "reset", "--local"], quiet);
    if (contract.rls)
      record("rls", () => {
        const dir = join(privateRoot, "rls");
        mkdirSync(dir);
        command("pnpm", ["run", "test:rls"], {
          ...quiet,
          env: { ...process.env, CI_RLS_REPORT_DIR: dir },
        });
        const sqlRoot = "supabase/tests/database";
        const sources = filesUnder(sqlRoot, ".sql");
        invariant(sources.length > 0, "Required pgTAP SQL files missing");
        const reports = filesUnder(dir, ".tap");
        invariant(
          reports.length === sources.length,
          "Missing or unexpected pgTAP reports",
        );
        const results = sources.map((source) =>
          validateTap(
            readFileSync(join(dir, `${relative(sqlRoot, source)}.tap`), "utf8"),
          ),
        );
        return {
          tests: results.reduce((sum, result) => sum + result.tests, 0),
          files: results.length,
        };
      });
    if (contract.integration)
      record("integration", () => {
        const path = join(privateRoot, "integration.json");
        command("pnpm", ["run", "test:integration"], {
          ...quiet,
          env: { ...process.env, CI_INTEGRATION_REPORT: path },
        });
        return validateVitest(readJson(path));
      });
  } finally {
    command("pnpm", ["exec", "supabase", "stop", "--no-backup"], quiet);
  }
}

const commands = {
  install: () => command("pnpm", ["install", "--frozen-lockfile"]),
  selftest: () =>
    command(process.execPath, ["--test", "scripts/ci/core.test.js"]),
  lint: () => command("pnpm", ["run", "lint"]),
  format: () => command("pnpm", ["run", "format:check"]),
  typecheck: () => command("pnpm", ["run", "typecheck"]),
  unit: runUnit,
  build: () => command("pnpm", ["run", "build"]),
  adversarial: () =>
    command(process.execPath, ["scripts/ci/quality-fixtures.js"]),
};

try {
  const operation = process.argv[2];
  if (operation === "init") initialize();
  else if (operation === "future") runFuture();
  else if (operation === "finish") {
    const state = existsSync(statePath())
      ? readJson(statePath())
      : { context: context(), checks: {}, status: "incomplete" };
    const required = [
      ...Object.keys(commands),
      ...["rls", "integration"].filter((s) => state.contract?.[s]),
    ];
    state.status = required.every((s) => state.checks[s]?.status === "passed")
      ? "passed"
      : "failed";
    outputSummary("checks", state);
  } else {
    invariant(Object.hasOwn(commands, operation), "Unknown CI check");
    record(operation, () => {
      const result = commands[operation]();
      return operation === "unit" ? result : {};
    });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
