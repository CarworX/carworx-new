import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { injectUndeclaredAuth } from "./auth-fixture.js";

const core = new URL("./core.js", import.meta.url).href;
for (const scenario of [
  "bootstrap",
  "existing empty auth",
  "active auth",
  "active security",
]) {
  test(`undeclared Auth is rejected and restored: ${scenario}`, () => {
    const root = mkdtempSync(join(tmpdir(), "k1-auth-regression-"));
    const git = (...args) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: "pipe" });
    git("init");
    mkdirSync(join(root, "scripts/ci"), { recursive: true });
    mkdirSync(join(root, "apps/web/app"), { recursive: true });
    const active = scenario.startsWith("active");
    const flags = { version: 1, rls: active, integration: active };
    const contract = join(root, "scripts/ci/contract.json");
    writeFileSync(contract, JSON.stringify(flags));
    if (active) {
      const dir = join(
        root,
        scenario === "active auth"
          ? "apps/web/app/auth"
          : "apps/web/app/server/security",
      );
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, "existing.ts"),
        "export const preserve = true;\n",
      );
    } else if (scenario === "existing empty auth") {
      mkdirSync(join(root, "apps/web/app/auth"));
    }
    git("add", ".");
    git(
      "-c",
      "user.name=CI fixture",
      "-c",
      "user.email=ci@example.test",
      "commit",
      "-m",
      "Synthetic fixture baseline",
    );
    const validate = () =>
      execFileSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          `import { suiteContract } from ${JSON.stringify(core)}; suiteContract('HEAD');`,
        ],
        { cwd: root, encoding: "utf8", stdio: "pipe" },
      );
    validate();
    const before = readFileSync(contract, "utf8");
    const hadAuth = existsSync(join(root, "apps/web/app/auth"));
    const cleanups = [];
    try {
      injectUndeclaredAuth(root, (fn) => cleanups.push(fn));
      assert.deepEqual(JSON.parse(readFileSync(contract, "utf8")), {
        ...flags,
        integration: false,
      });
      assert.throws(validate, (error) =>
        /Required suite cannot be disabled: integration/.test(
          String(error.stderr),
        ),
      );
    } finally {
      for (const cleanup of cleanups.reverse()) cleanup();
    }
    assert.equal(readFileSync(contract, "utf8"), before);
    assert.equal(existsSync(join(root, "apps/web/app/auth")), hadAuth);
    assert.equal(git("status", "--porcelain").trim(), "");
    validate();
  });
}
