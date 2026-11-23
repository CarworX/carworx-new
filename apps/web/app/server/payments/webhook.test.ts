import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  authenticPaystack,
  chargeEvent,
  rawPaystackBody,
} from "./webhook.server";

const secret = "sk_test_" + "S".repeat(24);
const reference = "cx_" + "a".repeat(32);
const payload = {
  event: "charge.success",
  data: {
    id: 123,
    domain: "test",
    reference,
    amount: 12500,
    currency: "ZAR",
    status: "success",
  },
};
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
const sign = (raw: Uint8Array, key = secret) =>
  createHmac("sha512", key).update(raw).digest("hex");

describe("A24/A25 Paystack event boundary", () => {
  it("authenticates exact raw bytes and rejects a changed body", async () => {
    const raw = bytes(payload),
      headers = new Headers({ "x-paystack-signature": sign(raw) });
    expect(await authenticPaystack(raw, headers, secret)).toBe(true);
    expect(
      await authenticPaystack(
        bytes({ ...payload, extra: true }),
        headers,
        secret,
      ),
    ).toBe(false);
  });
  it.each(["", "abc", "A".repeat(128), "0".repeat(128)])(
    "rejects invalid signature %s",
    async (signature) => {
      expect(
        await authenticPaystack(
          bytes(payload),
          new Headers({ "x-paystack-signature": signature }),
          secret,
        ),
      ).toBe(false);
    },
  );
  it("does not downgrade an invalid modern header to a valid legacy signature", async () => {
    const raw = bytes(payload);
    expect(
      await authenticPaystack(
        raw,
        new Headers({
          "x-paystack-signature": sign(raw),
          "paystack-signature": "t=0,v1=invalid",
        }),
        secret,
        "whsec_synthetic",
      ),
    ).toBe(false);
  });
  it("deduplicates charge replay but preserves refund and dispute transitions", async () => {
    const charge = await chargeEvent(bytes(payload));
    expect(await chargeEvent(bytes(payload))).toEqual(charge);
    const keys = new Set<string>();
    for (const event of [
      "refund.processed",
      "refund.failed",
      "charge.dispute.create",
      "charge.dispute.resolve",
    ]) {
      const result = await chargeEvent(
        bytes({
          event,
          data: {
            id: 456,
            domain: "test",
            amount: 500,
            currency: "ZAR",
            transaction: payload.data,
          },
        }),
      );
      expect(result).toMatchObject({ reference, kind: event });
      if (result !== null && result !== "ignored") keys.add(result.event_key);
    }
    expect(keys.size).toBe(4);
  });
  it.each([
    { amount: 0 },
    { amount: 1.5 },
    { amount: Number.MAX_SAFE_INTEGER + 1 },
    { currency: "USD" },
    { reference: "other" },
    { domain: "live" },
    { status: "pending" },
    { id: 0 },
  ])("rejects malformed charge %j", async (change) => {
    expect(
      await chargeEvent(
        bytes({ ...payload, data: { ...payload.data, ...change } }),
      ),
    ).toBeNull();
  });
  it("ignores unrelated event types", async () => {
    expect(await chargeEvent(bytes({ event: "customer.created" }))).toBe(
      "ignored",
    );
  });
  it("bounds actual streamed bytes rather than trusting content-length", async () => {
    const request = (length: number) =>
      new Request("https://example.test", {
        method: "POST",
        body: "x".repeat(length),
        headers: { "Content-Length": "1" },
      });
    expect((await rawPaystackBody(request(65536)))?.length).toBe(65536);
    expect(await rawPaystackBody(request(65537))).toBeNull();
  });
});
