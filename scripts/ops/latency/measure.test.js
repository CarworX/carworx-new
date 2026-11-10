import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compare,
  parseArgs,
  parseTarget,
  parseTrace,
  percentile,
  sastTimestamp,
  summarise,
  usable,
} from "./measure.js";

test("parseTrace keeps the edge and country and drops the IP", () => {
  const trace =
    "fl=1\nh=www.cloudflare.com\nip=198.51.100.7\nts=1\ncolo=JNB\nloc=ZA\n";
  const edge = parseTrace(trace);
  assert.deepEqual(edge, { colo: "JNB", loc: "ZA" });
  assert.equal(JSON.stringify(edge).includes("198.51.100.7"), false);
});

test("parseTrace rejects malformed fields", () => {
  assert.deepEqual(parseTrace("colo=jnb\nloc=ZAF"), { colo: null, loc: null });
  assert.deepEqual(parseTrace(""), { colo: null, loc: null });
});

test("percentile uses nearest rank", () => {
  const sorted = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(sorted, 50), 50);
  assert.equal(percentile(sorted, 95), 100);
  assert.equal(percentile([], 50), null);
});

test("summarise counts failures and rounds", () => {
  const s = summarise([150.04, null, 160.06, 170, null]);
  assert.equal(s.count, 5);
  assert.equal(s.failed, 2);
  assert.equal(s.min_ms, 150);
  assert.equal(s.p50_ms, 160.1);
  assert.equal(s.max_ms, 170);
  assert.equal(summarise([null]).p50_ms, null);
});

test("compare needs a clear margin", () => {
  const at = (p50) => ({ count: 30, failed: 0, p50_ms: p50 });
  assert.equal(compare(at(150), at(175)), "london-faster");
  assert.equal(compare(at(175), at(150)), "frankfurt-faster");
  assert.equal(compare(at(150), at(155)), "within-margin");
  assert.equal(compare(at(null), at(150)), "no-result");
});

test("compare refuses a target with too many failed samples", () => {
  const flaky = { count: 30, failed: 29, p50_ms: 100 };
  const steady = { count: 30, failed: 0, p50_ms: 120 };
  assert.equal(usable(flaky), false);
  assert.equal(compare(flaky, steady), "no-result");
  assert.equal(compare(steady, flaky), "no-result");
  assert.equal(usable({ count: 30, failed: 3, p50_ms: 100 }), true);
  assert.equal(usable({ count: 30, failed: 4, p50_ms: 100 }), false);
  assert.equal(usable({ count: 5, failed: 0, p50_ms: 100 }), true);
});

test("parseArgs validates bounds and targets", () => {
  assert.deepEqual(parseArgs([]).samples, 30);
  assert.equal(parseArgs(["--samples", "50", "--label", "cpt"]).label, "cpt");
  assert.throws(() => parseArgs(["--samples", "2"]));
  assert.throws(() => parseArgs(["--label", "Cape Town"]));
  assert.throws(() => parseArgs(["--bogus", "1"]));
  assert.throws(() => parseArgs(["--samples"]));
  assert.deepEqual(parseTarget("staging-db=db.example.test:5432"), {
    name: "staging-db",
    host: "db.example.test",
    port: 5432,
  });
  assert.throws(() => parseTarget("x=host:99999"));
  assert.throws(() => parseTarget("http://host"));
});

test("sastTimestamp is UTC plus two hours", () => {
  assert.equal(
    sastTimestamp(new Date("2026-11-10T10:00:00.000Z")),
    "2026-11-10T12:00:00.000+02:00",
  );
});

test("timeHandshake times a loopback TCP connect and reports a refused port", async () => {
  const { createServer } = await import("node:net");
  const { timeHandshake } = await import("./measure.js");
  const server = createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const ms = await timeHandshake({ host: "127.0.0.1", port }, false);
  assert.equal(typeof ms, "number");
  assert.ok(ms >= 0 && ms < 1000);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await timeHandshake({ host: "127.0.0.1", port }, false), null);
});
