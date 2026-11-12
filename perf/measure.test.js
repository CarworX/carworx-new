import assert from "node:assert/strict";
import test from "node:test";
import { withNavigationRetry } from "./measure.js";
const valid = { lhr: { categories: { performance: { score: 0 } } } };
const invalid = (code) => ({ lhr: { runtimeError: { code } } });

test("valid reports including low scores are returned without retry", async () => {
  let calls = 0;
  assert.equal(
    await withNavigationRetry(
      () => {
        calls++;
        return valid;
      },
      () => assert.fail(),
    ),
    valid,
  );
  assert.equal(calls, 1);
});
test("one NO_NAVSTART is retained before a fresh measurement", async () => {
  let calls = 0;
  const retained = [];
  assert.equal(
    await withNavigationRetry(
      () => (++calls === 1 ? invalid("NO_NAVSTART") : valid),
      (_report, attempt, code) => {
        retained.push([attempt, code]);
      },
    ),
    valid,
  );
  assert.equal(calls, 2);
  assert.deepEqual(retained, [[0, "NO_NAVSTART"]]);
});
test("repeated missing traces remain blocking and both attempts are retained", async () => {
  let calls = 0;
  const retained = [];
  await assert.rejects(
    withNavigationRetry(
      () => {
        calls++;
        return invalid("NO_NAVSTART");
      },
      (_report, attempt) => {
        retained.push(attempt);
      },
    ),
    { failureCode: "NO_NAVSTART" },
  );
  assert.equal(calls, 2);
  assert.deepEqual(retained, [0, 1]);
});
test("other errors and malformed reports never retry", async () => {
  for (const value of [invalid("NO_FCP"), invalid("unsafe value"), {}]) {
    let calls = 0;
    await assert.rejects(
      withNavigationRetry(
        () => {
          calls++;
          return value;
        },
        () => {},
      ),
    );
    assert.equal(calls, 1);
  }
});
test("measurement and evidence retention failures remain blocking", async () => {
  await assert.rejects(
    withNavigationRetry(
      () => {
        throw Error("measurement");
      },
      () => {},
    ),
  );
  let calls = 0;
  await assert.rejects(
    withNavigationRetry(
      () => {
        calls++;
        return invalid("NO_NAVSTART");
      },
      () => {
        throw Error("retention");
      },
    ),
  );
  assert.equal(calls, 1);
});
