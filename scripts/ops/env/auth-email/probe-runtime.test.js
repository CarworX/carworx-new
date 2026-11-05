import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  StagingProbe,
  probeEndpoint,
  probeSignature,
} from "./probe-runtime.js";

function fixture() {
  const data = new Map();
  const storage = {
    get: (key) => Promise.resolve(data.get(key)),
    put: (key, value) => Promise.resolve(data.set(key, value)),
    setAlarm: () => Promise.resolve(),
    transaction: (callback) => callback(storage),
  };
  const ledger = new StagingProbe({ storage });
  const binding = {
    idFromName: () => "test",
    get: () => ({
      fetch: (url, init) => ledger.fetch(new Request(url, init)),
    }),
  };
  const env = {
    STAGING_PROBES: binding,
    STAGING_PROBE_SOURCE_SHA: "a".repeat(40),
    STAGING_PROBE_EVENT_KEY: "synthetic-event-key".repeat(2),
    STAGING_PROBE_ADMIN_KEY: "synthetic-admin-key".repeat(2),
  };
  const call = async (message, role = "operator", skew = 0) => {
    const body = JSON.stringify({ recipient: "a".repeat(64), ...message });
    const time = String(Date.now() + skew);
    const key =
      role === "operator"
        ? env.STAGING_PROBE_ADMIN_KEY
        : env.STAGING_PROBE_EVENT_KEY;
    const signature = await probeSignature(
      key,
      `carworx-probe-v1\n${role}\n${time}\n${body}`,
    );
    return probeEndpoint(
      new Request("https://example.test/_ops/probe", {
        method: "POST",
        headers: {
          "x-carworx-probe-role": role,
          "x-carworx-probe-time": time,
          "x-carworx-probe-signature": signature,
        },
        body,
      }),
      env,
    );
  };
  return { call };
}

test("staging ledger accepts only observed application negatives for the deployed version", async () => {
  const { call } = fixture();
  const id = randomUUID();
  const app_version = randomUUID();
  const registration = {
    op: "register",
    id,
    version: "a".repeat(40),
    flow: "app_signup",
    app_version,
  };
  assert.equal((await call(registration, "app")).status, 403);
  assert.equal((await call(registration, "operator", -60_000)).status, 401);
  assert.equal(
    (await call({ ...registration, version: "b".repeat(40) })).status,
    409,
  );
  assert.equal((await call(registration)).status, 200);
  assert.equal((await call({ op: "seal", id })).status, 409);
  const terminal = { op: "event", kind: "app_terminal", id: randomUUID() };
  assert.equal(
    (await call({ ...terminal, app_version: randomUUID() }, "app")).status,
    409,
  );
  assert.equal((await call({ ...terminal, app_version }, "app")).status, 200);
  assert.equal((await call({ ...terminal, app_version }, "app")).status, 200);
  assert.deepEqual(await (await call({ op: "seal", id })).json(), {
    status: "passed",
    auth_calls: 0,
    provider_calls: 0,
    correlation_id: id,
  });
  assert.equal((await call({ op: "seal", id })).status, 409);
});
