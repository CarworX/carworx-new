import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchPaymentWebhook, drainPaymentEvents } from "./runtime.server";

const db = vi.hoisted(() => ({
  enqueue: vi.fn(),
  pending: vi.fn(),
  applyCharge: vi.fn(),
  defer: vi.fn(),
}));
vi.mock("./database.server", () => ({ moneyDatabase: () => db }));
const secret = "sk_test_" + "S".repeat(24);
const reference = "cx_" + "a".repeat(32);
const env = {
  CARWORX_ENV: "local",
  APP_ORIGIN: "http://localhost:5173",
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_000000000000",
  PAYSTACK_ENABLED: "1",
  PAYSTACK_MODE: "test",
  PAYSTACK_SECRET_KEY: secret,
  PAYSTACK_FEE_BEARER: "account",
  MONEY_DB: { connectionString: "synthetic-no-connection" },
};
const event = {
  event_key: "a".repeat(64),
  reference,
  provider_id: "123",
  kind: "charge.success",
  amount_minor: "12500",
  currency: "ZAR",
  status: "success",
};
function request(signature = true) {
  const body = JSON.stringify({
    event: "charge.success",
    data: {
      id: 123,
      domain: "test",
      reference,
      amount: 12500,
      currency: "ZAR",
      status: "success",
    },
  });
  return new Request(env.APP_ORIGIN + "/api/payments/paystack", {
    method: "POST",
    body,
    headers: {
      "x-paystack-signature": signature
        ? createHmac("sha512", secret).update(body).digest("hex")
        : "0".repeat(128),
    },
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  db.pending.mockResolvedValue([event]);
  db.enqueue.mockResolvedValue(undefined);
  db.applyCharge.mockResolvedValue(undefined);
  db.defer.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("A24/A25/A26 durable payment orchestration", () => {
  it("does not acknowledge until durable storage resolves and applies no inline effect", async () => {
    let release!: () => void;
    db.enqueue.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    let acknowledged = false;
    const pending = dispatchPaymentWebhook(request(), env).then((r) => {
      acknowledged = true;
      return r;
    });
    await vi.waitFor(() => {
      expect(db.enqueue).toHaveBeenCalledOnce();
    });
    expect(acknowledged).toBe(false);
    expect(db.applyCharge).not.toHaveBeenCalled();
    release();
    expect((await pending).status).toBe(200);
  });
  it("returns retryable failure if the durable insert fails", async () => {
    db.enqueue.mockRejectedValue(new Error("synthetic database outage"));
    expect((await dispatchPaymentWebhook(request(), env)).status).toBe(503);
    expect(db.applyCharge).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures before storage", async () => {
    expect((await dispatchPaymentWebhook(request(false), env)).status).toBe(
      401,
    );
    expect(db.enqueue).not.toHaveBeenCalled();
  });
  it.each([
    { id: 999 },
    { amount: 12501 },
    { currency: "USD" },
    { reference: "cx_" + "b".repeat(32) },
    { status: "pending" },
  ])("does not apply mismatched verification %j", async (change) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          status: true,
          data: {
            id: 123,
            domain: "test",
            reference,
            amount: 12500,
            currency: "ZAR",
            status: "success",
            ...change,
          },
        }),
      ),
    );
    await drainPaymentEvents(env);
    expect(db.applyCharge).not.toHaveBeenCalled();
    expect(db.defer).toHaveBeenCalledWith(event.event_key);
  });
  it("retries a persisted event after provider outage and after effect failure", async () => {
    const success = () =>
      Response.json({
        status: true,
        data: {
          id: 123,
          domain: "test",
          reference,
          amount: 12500,
          currency: "ZAR",
          status: "success",
        },
      });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValueOnce(new Error("synthetic outage"))
        .mockImplementation(() => Promise.resolve(success())),
    );
    await drainPaymentEvents(env);
    expect(db.applyCharge).not.toHaveBeenCalled();
    db.applyCharge.mockRejectedValueOnce(new Error("synthetic process crash"));
    await drainPaymentEvents(env);
    await drainPaymentEvents(env);
    expect(db.defer).toHaveBeenCalledTimes(2);
    expect(db.applyCharge).toHaveBeenCalledTimes(2);
    expect(db.applyCharge).toHaveBeenLastCalledWith(event.event_key, {
      reference,
      providerId: "123",
      amountMinor: 12500,
      currency: "ZAR",
      status: "success",
    });
  });
});
