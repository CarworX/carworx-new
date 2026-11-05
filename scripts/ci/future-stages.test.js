import assert from "node:assert/strict";
import test from "node:test";
import { runFutureStages } from "./future-stages.js";
import { readJson, validateTap, validateVitest } from "./core.js";

function fixture(faults = {}) {
  const calls = [];
  const states = {};
  const actions = Object.fromEntries(
    ["startup", "reset", "rls", "integration", "auth_delivery", "cleanup"].map(
      (name) => [
        name,
        () => {
          calls.push(name);
          if (faults[name]) faults[name]();
          return { tests: 1 };
        },
      ],
    ),
  );
  const record = (name, action) => {
    try {
      states[name] = { status: "passed", ...action() };
    } catch (error) {
      states[name] = { status: "failed" };
      throw error;
    }
  };
  return { calls, states, run: () => runFutureStages(actions, record) };
}

test("required stages execute in order and cleanup evidence is recorded", () => {
  const f = fixture();
  f.run();
  assert.deepEqual(f.calls, [
    "startup",
    "reset",
    "rls",
    "integration",
    "auth_delivery",
    "cleanup",
  ]);
  assert.ok(Object.values(f.states).every((s) => s.status === "passed"));
});

for (const stage of [
  "startup",
  "reset",
  "rls",
  "integration",
  "auth_delivery",
  "cleanup",
]) {
  test(`${stage} failure is labeled without disclosing command output`, () => {
    const privateOutput = "private diagnostic with local credentials";
    const f = fixture({
      [stage]: () => {
        throw new Error(privateOutput);
      },
    });
    assert.throws(f.run, (error) => {
      assert.equal(error.message, `Required suite stage failed: ${stage}`);
      assert.equal(String(error).includes(privateOutput), false);
      return true;
    });
    assert.equal(f.states[stage].status, "failed");
    assert.equal(f.calls.at(-1), "cleanup");
    if (stage !== "cleanup") {
      const order = ["startup", "reset", "rls", "integration", "auth_delivery"];
      assert.deepEqual(f.calls, [
        ...order.slice(0, order.indexOf(stage) + 1),
        "cleanup",
      ]);
    }
  });
}

test("cleanup failure preserves the first failure and both failed states", () => {
  const fail = () => {
    throw new Error("private output");
  };
  const f = fixture({ rls: fail, cleanup: fail });
  assert.throws(f.run, {
    message: "Required suite stage failed: rls; cleanup also failed",
  });
  assert.equal(f.states.rls.status, "failed");
  assert.equal(f.states.cleanup.status, "failed");
  assert.equal(f.states.integration, undefined);
});

test("missing or malformed reports fail their suite and still clean up", () => {
  for (const [stage, action] of [
    ["rls", () => validateTap("1..2\nok 1")],
    ["integration", () => validateVitest({ success: true })],
    [
      "auth_delivery",
      () => {
        throw new Error("malformed or missing boundary report");
      },
    ],
    [
      "integration",
      () => readJson(new URL("./nonexistent-report.json", import.meta.url)),
    ],
  ]) {
    const f = fixture({ [stage]: action });
    assert.throws(f.run, { message: `Required suite stage failed: ${stage}` });
    assert.equal(f.states[stage].status, "failed");
    assert.equal(f.states.cleanup.status, "passed");
  }
});
