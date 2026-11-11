import { describe, expect, it } from "vitest";

import {
  DUMMY_TOKEN,
  MAX_TOKEN_LENGTH,
  readTurnstile,
  SITEVERIFY_URL,
  TEST_SECRET_FAIL,
  TEST_SECRET_PASS,
  TEST_SITE_KEY_PASS,
  verifyTurnstile,
  type TurnstileSettings,
} from "./turnstile";

const REAL: TurnstileSettings = {
  siteKey: "0x4AAAAAAA-synthetic-site",
  secretKey: "0x4AAAAAAA-synthetic-secret-value",
  testMode: false,
};
const TEST: TurnstileSettings = {
  siteKey: TEST_SITE_KEY_PASS,
  secretKey: TEST_SECRET_PASS,
  testMode: true,
};

function answering(body: unknown, status = 200) {
  const calls: { url: string; body: URLSearchParams }[] = [];
  const send = ((url: string, init: RequestInit) => {
    calls.push({ url, body: init.body as URLSearchParams });
    return Promise.resolve(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
      }),
    );
  }) as unknown as typeof fetch;
  return { send, calls };
}

const opts = (send: typeof fetch) => ({
  action: "enquiry" as const,
  expectedHostname: "carworx.test",
  remoteIp: "198.51.100.7",
  send,
});

describe("readTurnstile", () => {
  it("accepts Cloudflare's test keys only in local", () => {
    const env = {
      TURNSTILE_SITE_KEY: TEST_SITE_KEY_PASS,
      TURNSTILE_SECRET_KEY: TEST_SECRET_PASS,
    };
    expect(readTurnstile(env, "local")?.testMode).toBe(true);
    expect(readTurnstile(env, "staging")).toBeUndefined();
    expect(readTurnstile(env, null)).toBeUndefined();
    expect(
      readTurnstile(
        { ...env, TURNSTILE_SECRET_KEY: TEST_SECRET_FAIL },
        "staging",
      ),
    ).toBeUndefined();
  });
  it("accepts real-looking keys anywhere, never in test mode", () => {
    const env = {
      TURNSTILE_SITE_KEY: REAL.siteKey,
      TURNSTILE_SECRET_KEY: REAL.secretKey,
    };
    expect(readTurnstile(env, "staging")).toEqual(REAL);
    expect(readTurnstile(env, "local")?.testMode).toBe(false);
  });
  it("closes the forms when a key is missing or malformed", () => {
    expect(readTurnstile({}, "local")).toBeUndefined();
    expect(
      readTurnstile({ TURNSTILE_SITE_KEY: REAL.siteKey }, "local"),
    ).toBeUndefined();
    expect(
      readTurnstile(
        {
          TURNSTILE_SITE_KEY: "<script>",
          TURNSTILE_SECRET_KEY: REAL.secretKey,
        },
        "local",
      ),
    ).toBeUndefined();
  });
});

describe("verifyTurnstile", () => {
  it("posts secret, token, IP and an idempotency key to siteverify", async () => {
    const { send, calls } = answering({
      success: true,
      hostname: "carworx.test",
      action: "enquiry",
    });
    expect(await verifyTurnstile(REAL, "tok", opts(send))).toBe("pass");
    expect(calls[0]?.url).toBe(SITEVERIFY_URL);
    const body = calls[0]?.body;
    expect(body?.get("secret")).toBe(REAL.secretKey);
    expect(body?.get("response")).toBe("tok");
    expect(body?.get("remoteip")).toBe("198.51.100.7");
    expect(body?.get("idempotency_key")).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("fails a pass for another hostname or action (real keys)", async () => {
    expect(
      await verifyTurnstile(
        REAL,
        "tok",
        opts(
          answering({ success: true, hostname: "evil.test", action: "enquiry" })
            .send,
        ),
      ),
    ).toBe("fail");
    expect(
      await verifyTurnstile(
        REAL,
        "tok",
        opts(
          answering({
            success: true,
            hostname: "carworx.test",
            action: "support",
          }).send,
        ),
      ),
    ).toBe("fail");
  });
  it("in test mode accepts Cloudflare's example.com answer with no action", async () => {
    const answer = { success: true, hostname: "example.com" };
    expect(
      await verifyTurnstile(TEST, DUMMY_TOKEN, opts(answering(answer).send)),
    ).toBe("pass");
    expect(
      await verifyTurnstile(REAL, DUMMY_TOKEN, opts(answering(answer).send)),
    ).toBe("fail");
  });
  it("visitor-side failures are 'fail'", async () => {
    for (const code of ["invalid-input-response", "timeout-or-duplicate"])
      expect(
        await verifyTurnstile(
          REAL,
          "tok",
          opts(answering({ success: false, "error-codes": [code] }).send),
        ),
      ).toBe("fail");
  });
  it("our own or Cloudflare's faults are 'unavailable'", async () => {
    for (const code of [
      "invalid-input-secret",
      "internal-error",
      "bad-request",
    ])
      expect(
        await verifyTurnstile(
          REAL,
          "tok",
          opts(answering({ success: false, "error-codes": [code] }).send),
        ),
      ).toBe("unavailable");
  });
  it("fails closed on HTTP errors, bad JSON, odd answers and network errors", async () => {
    expect(
      await verifyTurnstile(REAL, "tok", opts(answering({}, 500).send)),
    ).toBe("unavailable");
    expect(
      await verifyTurnstile(REAL, "tok", opts(answering("not json").send)),
    ).toBe("unavailable");
    expect(
      await verifyTurnstile(
        REAL,
        "tok",
        opts(answering({ success: "yes" }).send),
      ),
    ).toBe("unavailable");
    const broken = (() =>
      Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(await verifyTurnstile(REAL, "tok", opts(broken))).toBe(
      "unavailable",
    );
  });
  it("refuses a missing, empty or oversized token without calling Cloudflare", async () => {
    const { send, calls } = answering({ success: true });
    for (const token of [undefined, null, "", "x".repeat(MAX_TOKEN_LENGTH + 1)])
      expect(await verifyTurnstile(REAL, token, opts(send))).toBe("fail");
    expect(calls).toHaveLength(0);
  });
});
