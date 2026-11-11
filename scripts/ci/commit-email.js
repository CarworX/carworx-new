// D-087: every commit in a PR must use a noreply author and committer email,
// so the owner's personal address never enters history again.
// Usage: node scripts/ci/commit-email.js <base-sha> <head-sha>
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const ALLOWED = [
  /^\d+\+[A-Za-z0-9-]+@users\.noreply\.github\.com$/,
  /^[A-Za-z0-9-]+@users\.noreply\.github\.com$/,
  /^noreply@github\.com$/,
  /^noreply@anthropic\.com$/,
  /^[A-Za-z0-9._+-]*noreply@openai\.com$/,
];

export function allowed(email) {
  return ALLOWED.some((pattern) => pattern.test(email));
}

// Returns the short SHAs of commits that break the rule. Never prints an
// address, so a leaked one isn't copied into CI logs.
export function offenders(lines) {
  return lines
    .map((line) => line.split("\t"))
    .filter(([, author, committer]) => !allowed(author) || !allowed(committer))
    .map(([sha]) => sha.slice(0, 7));
}

function main([base, head]) {
  if (!/^[a-f0-9]{40}$/.test(base ?? "") || !/^[a-f0-9]{40}$/.test(head ?? ""))
    throw new Error("Usage: commit-email.js <base-sha> <head-sha>");
  const out = execFileSync(
    "git",
    ["log", "--format=%H%x09%ae%x09%ce", `${base}..${head}`],
    { encoding: "utf8" },
  );
  const bad = offenders(out.split("\n").filter(Boolean));
  if (bad.length > 0) {
    console.error(
      `Commits with a non-noreply email (D-087): ${bad.join(", ")}. ` +
        "Rewrite them with a noreply address; see AGENTS.md.",
    );
    process.exitCode = 1;
  } else console.log("All PR commits use noreply emails.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
