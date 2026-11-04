// Fault injection for an isolated CI scratch worktree only.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, sep } from "node:path";

export function injectUndeclaredAuth(root, cleanup) {
  const contract = join(root, "scripts/ci/contract.json");
  const original = readFileSync(contract, "utf8");
  const dir = join(root, "apps/web/app/auth");
  const existed = existsSync(dir);
  mkdirSync(dir, { recursive: true });
  const temporary = mkdtempSync(join(dir, "k1-fixture-"));
  const file = join(temporary, "marker.ts");
  const path = relative(root, file).split(sep).join("/");
  cleanup(() => {
    execFileSync("git", ["restore", "--staged", "--", path], {
      cwd: root,
      stdio: "pipe",
    });
    rmSync(file);
    rmdirSync(temporary);
    if (!existed) rmdirSync(dir);
    writeFileSync(contract, original);
  });
  writeFileSync(file, "export {};\n");
  // Deliberately contradict the implementation marker, even after T3 activates
  // integration. RLS and every other real flag retain their original values.
  writeFileSync(
    contract,
    JSON.stringify({ ...JSON.parse(original), integration: false }),
  );
  execFileSync("git", ["add", "--", path], { cwd: root, stdio: "pipe" });
  return file;
}
