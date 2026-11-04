import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  cpSync,
  constants,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { invariant } from "./core.js";
import { injectUndeclaredAuth } from "./auth-fixture.js";

// Only mutate our new temporary worktree, never the checked-out PR or its index.
const root = mkdtempSync(join(process.env.RUNNER_TEMP, "k1-quality-fixtures-"));
const scratch = join(root, "source");
execFileSync("git", ["worktree", "add", "--detach", scratch, "HEAD"], {
  stdio: "pipe",
});
for (const path of ["node_modules", "apps/web/node_modules"]) {
  invariant(
    existsSync(path),
    "Dependencies missing for actual failure fixtures",
  );
  cpSync(join(process.cwd(), path), join(scratch, path), {
    recursive: true,
    verbatimSymlinks: true,
    mode: constants.COPYFILE_FICLONE,
  });
}
const sourcePath = join(scratch, "apps/web/app/routes/healthz.ts");
const testPath = join(scratch, "apps/web/app/routes/healthz.test.ts");
const contractPath = join(scratch, "scripts/ci/contract.json");
const packagePath = join(scratch, "package.json");
const vitestPath = join(scratch, "apps/web/vitest.config.ts");
const original = new Map(
  [sourcePath, testPath, contractPath, packagePath, vitestPath].map((p) => [
    p,
    readFileSync(p, "utf8"),
  ]),
);

// Override the configured suite, rather than assuming healthz is its only file.
function unitFixture(test) {
  const config = original.get(vitestPath);
  invariant(
    config.includes("export default"),
    "Unsupported Vitest fixture config",
  );
  writeFileSync(
    vitestPath,
    `${config.replace("export default", "const k1Original =")}\nexport default { ...k1Original, test: { ...k1Original.test, ...${JSON.stringify(test)} } };\n`,
  );
}

const run = (stage, env) =>
  spawnSync(process.execPath, ["scripts/ci/checks.js", stage], {
    cwd: scratch,
    env,
    encoding: "utf8",
    stdio: "pipe",
    timeout: 5 * 60 * 1000,
  });
function attempt(name, mutate, stage, expected) {
  for (const [path, content] of original) writeFileSync(path, content);
  const temp = mkdtempSync(join(root, "run-"));
  const env = { ...process.env, RUNNER_TEMP: temp };
  const init = run("init", env);
  invariant(!init.error && init.status === 0, `Fixture setup failed: ${name}`);
  let result;
  const cleanups = [];
  try {
    mutate((cleanup) => cleanups.push(cleanup));
    result = run(stage, env);
  } finally {
    for (const [path, content] of original) writeFileSync(path, content);
    for (const cleanup of cleanups.reverse()) cleanup();
    invariant(
      execFileSync("git", ["status", "--porcelain"], {
        cwd: scratch,
        encoding: "utf8",
      }).trim() === "",
      `Fixture left modified files: ${name}`,
    );
  }
  if (
    result.error ||
    result.status === 0 ||
    !expected.test(result.stdout + result.stderr)
  ) {
    // Quality fixtures have no application secrets or running Supabase services.
    console.error(
      `Fixture ${name} exited ${result.status}: ${String(result.stdout + result.stderr).slice(-3500)}`,
    );
  }
  invariant(
    !result.error &&
      result.status !== null &&
      result.status !== 0 &&
      expected.test(result.stdout + result.stderr),
    `Failure fixture was not rejected for the expected reason: ${name}`,
  );
  console.log(`Rejected injected ${name} fault`);
}

attempt(
  "lint",
  () =>
    writeFileSync(
      sourcePath,
      `${original.get(sourcePath)}\nconst k1Unused = 1;\n`,
    ),
  "lint",
  /k1Unused/,
);
attempt(
  "format",
  () =>
    writeFileSync(
      sourcePath,
      `${original.get(sourcePath)}\nexport const k1Format=  1\n`,
    ),
  "format",
  /Code style issues/,
);
attempt(
  "type",
  () =>
    writeFileSync(
      sourcePath,
      `${original.get(sourcePath)}\nexport const k1Type: number = "wrong";\n`,
    ),
  "typecheck",
  /not assignable to type 'number'/,
);
attempt(
  "unit",
  () =>
    writeFileSync(
      testPath,
      original.get(testPath).replace("toBe(200)", "toBe(201)"),
    ),
  "unit",
  /201/,
);
attempt(
  "build",
  () =>
    writeFileSync(
      sourcePath,
      `import "./k1-missing-module.js";\n${original.get(sourcePath)}`,
    ),
  "build",
  /k1-missing-module/,
);
attempt(
  "zero-tests",
  () => unitFixture({ include: [], passWithNoTests: false }),
  "unit",
  /No test files found/,
);
attempt(
  "all-skipped",
  () => unitFixture({ testNamePattern: "^__k1_no_test_matches__$" }),
  "unit",
  /Tests missing, failed or skipped/,
);
attempt(
  "missing-report",
  () => {
    const pkg = JSON.parse(original.get(packagePath));
    pkg.scripts.test = 'node -e "process.exit(0)" --';
    writeFileSync(packagePath, JSON.stringify(pkg));
  },
  "unit",
  /Missing or invalid JSON/,
);
attempt(
  "missing-required-command",
  () => {
    const contract = JSON.parse(original.get(contractPath));
    writeFileSync(contractPath, JSON.stringify({ ...contract, rls: true }));
    const pkg = JSON.parse(original.get(packagePath));
    delete pkg.scripts["test:rls"];
    writeFileSync(packagePath, JSON.stringify(pkg));
  },
  "init",
  /Missing test:rls command/,
);
attempt(
  "undeclared-auth",
  (cleanup) => injectUndeclaredAuth(scratch, cleanup),
  "init",
  /Required suite cannot be disabled: integration/,
);
console.log("All 10 actual command/activation failure fixtures passed");
