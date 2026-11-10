import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  StagingProbe,
  createHookObserver,
  observeHook,
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
  return { call, env };
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

test("direct receipt can only be read after the signed hook boundary records denial", async () => {
  const { call, env } = fixture();
  const id = randomUUID();
  const version = "a".repeat(40);
  const flow = "unapproved_signup";
  const event = {
    recipient: "fixture@example.test",
    id: randomUUID(),
    eligible: false,
  };
  const read = { op: "read", flow, id, version };
  assert.equal((await call({ op: "register", id, version, flow })).status, 200);
  assert.equal((await call(read)).status, 409);
  assert.equal(
    (await call({ op: "event", id: randomUUID(), kind: "recipient_denied" }))
      .status,
    400,
  );
  await observeHook("hook_invocation", event, env);
  assert.equal((await call({ op: "seal", id })).status, 409);
  await observeHook("recipient_denied", event, env);
  assert.equal((await call({ op: "seal", id })).status, 200);
  assert.equal(
    (await call({ ...read, flow: "unapproved_resend" })).status,
    409,
  );
  assert.deepEqual(await (await call(read)).json(), {
    status: "passed",
    hook_calls: 1,
    provider_calls: 0,
    correlation_id: id,
  });
});

test("unavailable observation cannot fail ordinary mail but cannot provide a receipt", async () => {
  const { env, call } = fixture();
  const event = {
    recipient: "fixture@example.test",
    id: randomUUID(),
    eligible: true,
  };
  let lookups = 0;
  env.STAGING_PROBES.get = () => ({
    fetch: async () => {
      lookups += 1;
      throw Error("outage");
    },
  });
  const observer = createHookObserver();
  await observer("hook_invocation", event, env);
  await observer("provider_attempt", event, env);
  await observer("provider_success", event, env);
  assert.equal(lookups, 1);
  assert.equal((await call({ op: "seal", id: randomUUID() })).status, 409);
});

test("confirmed registered probes fail closed on later observation failure", async () => {
  const { env, call } = fixture();
  const id = randomUUID();
  await call({
    op: "register",
    id,
    version: "a".repeat(40),
    flow: "approved_recovery",
  });
  const event = {
    recipient: "fixture@example.test",
    id: randomUUID(),
    eligible: true,
  };
  const observer = createHookObserver();
  await observer("hook_invocation", event, env);
  const get = env.STAGING_PROBES.get;
  env.STAGING_PROBES.get = () => ({
    fetch: async () => new Response(null, { status: 503 }),
  });
  await assert.rejects(observer("provider_attempt", event, env));
  env.STAGING_PROBES.get = get;
  assert.equal((await call({ op: "seal", id })).status, 409);
});

test("controlled faults remain fail closed only on the registered request", async () => {
  const { env, call } = fixture();
  const event = {
    recipient: "fixture@example.test",
    id: randomUUID(),
    eligible: true,
  };
  await call({
    op: "register",
    id: randomUUID(),
    version: "a".repeat(40),
    flow: "hook_failure_no_fallback",
  });
  await assert.rejects(
    createHookObserver()("hook_invocation", event, env),
    /Controlled/,
  );
  const { env: ordinary } = fixture();
  await createHookObserver()("hook_invocation", event, ordinary);
});

test("probe fetch aborts a stalled lookup without blocking ordinary mail", async () => {
  const { env } = fixture();
  let aborted = false;
  const alive = setTimeout(() => {}, 2000);
  env.STAGING_PROBES.get = () => ({
    fetch: (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(signal.reason);
          },
          { once: true },
        );
      }),
  });
  try {
    await createHookObserver()(
      "hook_invocation",
      {
        recipient: "fixture@example.test",
        id: randomUUID(),
        eligible: true,
      },
      env,
    );
    assert.equal(aborted, true);
  } finally {
    clearTimeout(alive);
  }
});
