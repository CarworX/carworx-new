import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

test("K1 always triggers for ready PRs, including arbitrarily large diffs", () => {
  const source = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const trigger = source.split("permissions:")[0];
  assert.doesNotMatch(trigger, /\bpaths(?:-ignore)?:/);
  assert.match(trigger, /ready_for_review/);
  assert.match(trigger, /synchronize/);
  for (const job of ["checks", "secrets", "ci"]) {
    const block = source.split(`  ${job}:`)[1]?.split(/\n  [a-z]+:/)[0];
    assert.ok(block);
    assert.match(block, /!github.event.pull_request.draft/);
  }
  assert.match(source, /always\(\)/);
  assert.match(source, /needs: \[checks, secrets\]/);
});
