import { describe, expect, it, vi } from "vitest";
import {
  createPaystack,
  readPaystackConfig,
  type PayableHold,
} from "./paystack.server";

const config = {
  secret: "sk_test_" + "S".repeat(24),
  origin: "https://staging.example.test",
  feeBearer: "account" as const,
};
const reference = "cx_" + "a".repeat(32);
const hold: PayableHold = {
  holdId: "a1000000-0000-4000-8000-000000000001",
  bookingId: "a1000000-0000-4000-8000-000000000002",
  organisationId: "a1000000-0000-4000-8000-000000000003",
  quoteVersionId: null,
  amountMinor: 12500,
  currency: "ZAR",
  expiresAt: new Date(Date.now() + 600000).toISOString(),
};
const response = (data: unknown) => Response.json({ status: true, data });

describe("A21/A25/A35 local Paystack adapter (no provider network)", () => {
  it("takes amount, reference and split from the server snapshot", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        reference,
        authorization_url: "https://checkout.paystack.com/synthetic",
        access_code: "synthetic",
      }),
    );
    const provider = createPaystack(config, fetcher);
    await expect(
      provider.initialise(
        hold,
        "synthetic@example.test",
        reference,
        "ACCT_synthetic",
      ),
    ).resolves.toMatchObject({
      url: "https://checkout.paystack.com/synthetic",
    });
    const call = fetcher.mock.calls[0];
    if (call === undefined) throw new Error("Expected initialise request");
    const [url, init] = call;
    expect(url).toBe("https://api.paystack.co/transaction/initialize");
    expect(init?.redirect).toBe("error");
    if (typeof init?.body !== "string") throw new Error("Expected JSON body");
    expect(JSON.parse(init.body)).toMatchObject({
      amount: 12500,
      currency: "ZAR",
      reference,
      subaccount: "ACCT_synthetic",
      transaction_charge: 0,
      callback_url: config.origin + "/payments/result?reference=" + reference,
    });
  });
  it.each([
    "https://checkout.paystack.com.evil.test/x",
    "http://checkout.paystack.com/x",
    "https://user@checkout.paystack.com/x",
    "https://checkout.paystack.com:444/x",
  ])("rejects unsafe checkout URL %s", async (url) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        reference,
        authorization_url: url,
        access_code: "synthetic",
      }),
    );
    await expect(
      createPaystack(config, fetcher).initialise(
        hold,
        "synthetic@example.test",
        reference,
        "ACCT_synthetic",
      ),
    ).rejects.toThrow("payment_provider_unavailable");
  });
  it.each([
    { amountMinor: 0 },
    { amountMinor: 1.5 },
    { expiresAt: "invalid" },
    { expiresAt: "2000-01-01" },
  ])("rejects invalid hold without a request %j", async (change) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      createPaystack(config, fetcher).initialise(
        { ...hold, ...change },
        "synthetic@example.test",
        reference,
        "ACCT_synthetic",
      ),
    ).rejects.toThrow("payment_input_invalid");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { domain: "live" },
    { currency: "USD" },
    { reference: "cx_" + "b".repeat(32) },
    { amount: -1 },
    { id: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects invalid provider verification %j", async (change) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        id: 123,
        domain: "test",
        reference,
        currency: "ZAR",
        amount: 12500,
        status: "success",
        ...change,
      }),
    );
    await expect(
      createPaystack(config, fetcher).verify(reference),
    ).rejects.toThrow();
  });
  it("recovers verification after an outage without another initialise", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("synthetic outage"))
      .mockResolvedValueOnce(
        response({
          id: 123,
          domain: "test",
          reference,
          currency: "ZAR",
          amount: 12500,
          status: "success",
        }),
      );
    const provider = createPaystack(config, fetcher);
    await expect(provider.verify(reference)).rejects.toThrow(
      "payment_provider_unavailable",
    );
    await expect(provider.verify(reference)).resolves.toMatchObject({
      providerId: "123",
      amountMinor: 12500,
      status: "success",
    });
    expect(
      fetcher.mock.calls.every(
        ([url]) =>
          typeof url === "string" && url.includes("/transaction/verify/"),
      ),
    ).toBe(true);
  });
  it("fails closed for live keys and production", () => {
    expect(() =>
      createPaystack({ ...config, secret: "sk_live_" + "S".repeat(24) }),
    ).toThrow("payment_test_mode_required");
    const security = {
      appOrigin: config.origin,
      supabaseUrl: "https://supabase.example.test",
      supabasePublishableKey: "synthetic",
      environment: "production" as const,
      approvedRecipients: null,
    };
    expect(
      readPaystackConfig(
        {
          PAYSTACK_ENABLED: "1",
          PAYSTACK_MODE: "test",
          PAYSTACK_SECRET_KEY: config.secret,
          PAYSTACK_FEE_BEARER: "account",
        },
        security,
      ),
    ).toBeNull();
  });
});
