import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const workflow = new URL("../../.github/workflows/ci.yml", import.meta.url);
const source = readFileSync(workflow, "utf8");

function verifyReadyGate(text) {
  const trigger = text.split("permissions:")[0];
  assert.doesNotMatch(trigger, /\bpaths(?:-ignore)?:/, "path suppression");
  for (const event of ["opened", "reopened", "synchronize", "ready_for_review"])
    assert.ok(trigger.includes(event), `missing ${event}`);
  const jobs = {};
  for (const job of ["checks", "secrets", "ci"]) {
    const block = text.split(`  ${job}:`)[1]?.split(/\n {2}[a-z]+:/)[0];
    assert.ok(block, `missing ${job}`);
    assert.match(
      block,
      /^ {4}if:.*!github\.event\.pull_request\.draft/m,
      `draft gate ${job}`,
    );
    jobs[job] = block;
  }
  assert.match(
    jobs.ci,
    /^ {4}if:.*always\(\)/m,
    "final gate must always evaluate",
  );
  assert.match(jobs.ci, /needs: \[checks, secrets\]/, "required dependencies");
  assert.match(jobs.ci, /node scripts\/ci\/gate\.js/, "evidence gate");
}

test("K1 triggers for every ready PR and defers drafts", () => {
  verifyReadyGate(source);
  assert.equal(
    existsSync(new URL("../../.github/workflows/docs.yml", import.meta.url)),
    false,
  );
});

test("path filters, missing triggers, draft bypass and missing final gates fail", () => {
  const faults = [
    source.replace("  pull_request:", "  pull_request:\n    paths: [docs/**]"),
    source.replace(
      "  pull_request:",
      "  pull_request:\n    paths-ignore: [docs/**]",
    ),
    source.replace("ready_for_review", "edited"),
    source.replaceAll("!github.event.pull_request.draft", "true"),
    source.replace("always() && !", "!"),
    source.replace("needs: [checks, secrets]", "needs: [checks]"),
    source.replace("node scripts/ci/gate.js", "echo bypass"),
  ];
  for (const broken of faults) {
    assert.notEqual(broken, source);
    assert.throws(() => verifyReadyGate(broken));
  }
});
