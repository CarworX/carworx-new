import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { Webhook } from "standardwebhooks";
import { createAuthEmailHandler } from "./handler.js";
import { deliverResend } from "./index.js";
import { createHookObserver } from "./probe-runtime.js";

function fixture(observer) {
  const secret = randomBytes(32).toString("base64");
  const env = {
    SEND_EMAIL_HOOK_SECRET: `v1,whsec_${secret}`,
    STAGING_APPROVED_RECIPIENTS_JSON: JSON.stringify(["approved@example.test"]),
    STAGING_AUTH_EMAIL_FROM: "sender@example.test",
    APP_ORIGIN: "https://staging.example.test",
  };
  const deliveries = [];
  const handle = createAuthEmailHandler(
    async (...args) => {
      deliveries.push(args);
    },
    { observe: observer },
  );
  const request = (
    payload = {
      user: { email: "approved@example.test" },
      email_data: {
        email_action_type: "signup",
        token_hash: randomBytes(32).toString("hex"),
        redirect_to: "https://untrusted.example",
      },
    },
    date = new Date(),
  ) => {
    const body = JSON.stringify(payload),
      id = `msg_${randomUUID()}`;
    return new Request("https://hook.example.test", {
      method: "POST",
      body,
      headers: {
        "webhook-id": id,
        "webhook-timestamp": String(Math.floor(date.getTime() / 1000)),
        "webhook-signature": new Webhook(secret).sign(id, date, body),
      },
    });
  };
  return { env, deliveries, handle, request };
}

test("valid signed confirmation and recovery use only fixed-origin token-hash links", async () => {
  for (const action of ["signup", "recovery"]) {
    const f = fixture();
    const payload = {
      user: { email: " APPROVED@EXAMPLE.TEST " },
      email_data: {
        email_action_type: action,
        token_hash: randomBytes(32).toString("hex"),
        redirect_to: "https://untrusted.example",
      },
    };
    const response = await f.handle(f.request(payload), f.env);
    assert.equal(response.status, 200);
    assert.equal(f.deliveries.length, 1);
    const [message, , idempotency] = f.deliveries[0];
    assert.deepEqual(message.to, ["approved@example.test"]);
    const link = new URL(message.text.split("\n\n")[1]);
    assert.equal(link.origin, f.env.APP_ORIGIN);
    assert.equal(link.pathname, "/auth/confirm");
    assert.equal(
      link.searchParams.get("type"),
      action === "signup" ? "email" : "recovery",
    );
    assert.equal(message.text.includes("untrusted"), false);
    assert.ok(idempotency.startsWith("cx-auth/"));
  }
});

test("unapproved, alias and wildcard addresses cannot invoke delivery", async () => {
  for (const email of [
    "other@example.test",
    "approved+tag@example.test",
    "prefixapproved@example.test",
    "approved@sub.example.test",
    "*@example.test",
  ]) {
    const f = fixture();
    const response = await f.handle(
      f.request({
        user: { email },
        email_data: {
          email_action_type: "signup",
          token_hash: randomBytes(32).toString("hex"),
        },
      }),
      f.env,
    );
    assert.equal(response.status, email.startsWith("*") ? 403 : 200);
    assert.equal(f.deliveries.length, 0);
    assert.equal((await response.text()).includes(email), false);
  }
});

test("missing, empty and malformed policy never delivers", async () => {
  for (const policy of [
    undefined,
    "",
    "[]",
    "{}",
    "bad-json",
    JSON.stringify(["*@example.test"]),
  ]) {
    const f = fixture();
    const response = await f.handle(f.request(), {
      ...f.env,
      STAGING_APPROVED_RECIPIENTS_JSON: policy,
    });
    assert.equal(response.status, 503);
    assert.equal(f.deliveries.length, 0);
  }
});

test("unsupported Auth actions never invoke a provider", async () => {
  for (const action of [
    "email_change",
    "invite",
    "magiclink",
    "reauthentication",
    "unknown",
  ]) {
    const f = fixture();
    assert.equal(
      (
        await f.handle(
          f.request({
            user: {
              email: "approved@example.test",
              new_email: "other@example.test",
            },
            email_data: {
              email_action_type: action,
              token_hash: randomBytes(32).toString("hex"),
            },
          }),
          f.env,
        )
      ).status,
      403,
    );
    assert.equal(f.deliveries.length, 0);
  }
});

test("bad, old and missing signatures fail before parsing/delivery", async () => {
  const f = fixture();
  const requests = [
    new Request("https://hook.example.test", { method: "POST", body: "{}" }),
    f.request(undefined, new Date(Date.now() - 600_000)),
    f.request(undefined, new Date(Date.now() + 600_000)),
  ];
  const bad = f.request();
  bad.headers.set("webhook-signature", "v1,invalid");
  requests.push(bad);
  for (const request of requests)
    assert.equal((await f.handle(request, f.env)).status, 401);
  assert.equal(f.deliveries.length, 0);
});

test("malformed payloads, local production origin and oversized streams fail closed", async () => {
  const f = fixture();
  assert.equal(
    (await f.handle(f.request({ user: {}, email_data: {} }), f.env)).status,
    403,
  );
  assert.equal(
    (
      await f.handle(f.request(), {
        ...f.env,
        APP_ORIGIN: "http://localhost:5173",
      })
    ).status,
    503,
  );
  assert.equal(
    (
      await f.handle(
        new Request("https://hook.example.test", {
          method: "POST",
          body: "x".repeat(65537),
        }),
        f.env,
      )
    ).status,
    413,
  );
  assert.equal(f.deliveries.length, 0);
});

test("provider failures are generic and never cause another provider attempt", async () => {
  const f = fixture();
  let calls = 0;
  const handle = createAuthEmailHandler(async () => {
    calls++;
    throw new Error("private provider detail");
  });
  const response = await handle(f.request(), f.env);
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
  assert.equal((await response.text()).includes("private provider"), false);
});

test("production transport fixes URL/timeout and uses idempotency without returning provider data", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, init) => {
      calls++;
      assert.equal(url, "https://api.resend.com/emails");
      assert.ok(init.signal);
      assert.equal(init.headers["Idempotency-Key"], "fixture-id");
      return Response.json({ id: "fixture-result" });
    };
    await deliverResend(
      { to: ["approved@example.test"] },
      { STAGING_RESEND_API_KEY: randomUUID() },
      "fixture-id",
    );
    assert.equal(calls, 1);
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ error: "private detail" }, { status: 503 });
    };
    await assert.rejects(
      deliverResend({}, { STAGING_RESEND_API_KEY: randomUUID() }, "fixture-id"),
      { message: "Delivery unavailable" },
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("missing signing/provider configuration cannot dispatch mail", async () => {
  const f = fixture();
  assert.equal(
    (
      await f.handle(f.request(), {
        ...f.env,
        SEND_EMAIL_HOOK_SECRET: undefined,
      })
    ).status,
    503,
  );
  assert.equal(f.deliveries.length, 0);
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      throw new Error("unexpected network");
    };
    await assert.rejects(deliverResend({}, {}, "fixture-id"), {
      message: "Delivery unavailable",
    });
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("provider timeout aborts a stalled request with one attempt and no fallback", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let aborted = false;
  const alive = setTimeout(() => undefined, 5000);
  try {
    globalThis.fetch = async (_url, init) =>
      new Promise((_resolve, reject) => {
        calls++;
        init.signal.addEventListener(
          "abort",
          () => {
            aborted = true;
            reject(new Error("synthetic timeout"));
          },
          { once: true },
        );
      });
    await assert.rejects(
      deliverResend({}, { STAGING_RESEND_API_KEY: randomUUID() }, "fixture-id"),
    );
    assert.equal(aborted, true);
    assert.equal(calls, 1);
  } finally {
    clearTimeout(alive);
    globalThis.fetch = original;
  }
});

test("probe storage outages do not prevent ordinary signed signup and recovery delivery", async () => {
  for (const action of ["signup", "recovery"]) {
    for (const outage of [
      async () => {
        throw Error("synthetic storage outage");
      },
      async () => new Response(null, { status: 503 }),
    ]) {
      const f = fixture(createHookObserver());
      const env = {
        ...f.env,
        STAGING_PROBE_EVENT_KEY: "synthetic-probe-key".repeat(3),
        STAGING_PROBES: {
          idFromName: () => "fixture",
          get: () => ({ fetch: outage }),
        },
      };
      const response = await f.handle(
        f.request({
          user: { email: "approved@example.test" },
          email_data: {
            email_action_type: action,
            token_hash: randomBytes(32).toString("hex"),
          },
        }),
        env,
      );
      assert.equal(response.status, 200);
      assert.equal(f.deliveries.length, 1);
    }
  }
});
