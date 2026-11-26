import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { SignedIn } from "../../auth/session.server";
import {
  parseScenario,
  sandboxAdapter,
  sandboxCallbackRequest,
} from "./sandbox.server";

const env = {
  CARWORX_ENV: "staging",
  FINES_PROVIDER: "sandbox",
  SEARCH_CURSOR_KEY: `synthetic-fines-${randomUUID()}`,
};
const origin = "https://test.example";
const event = {
  paymentId: "ae686b96-471c-487e-96c2-84babed729d9",
  status: "paid",
} as const;
function auth(state: string) {
  return {
    user: { id: "customer" },
    supabase: {
      rpc: () => Promise.resolve({ data: [{ state }], error: null }),
    },
  } as unknown as SignedIn;
}

describe("synthetic fines adapter", () => {
  it("requires approved identity and a staging provider for lookup and checkout", async () => {
    const unverified = sandboxAdapter(env, auth("in_review"));
    expect(await unverified.lookup("customer")).toBe("unavailable");
    await expect(
      unverified.startCheckout("customer", ["GP-2026-118452"]),
    ).rejects.toThrow("identity_required");
    expect(await sandboxAdapter(env, auth("approved")).lookup("other")).toBe(
      "unavailable",
    );
    const outsideStaging = sandboxAdapter(
      { ...env, CARWORX_ENV: "production" },
      auth("approved"),
    );
    expect(await outsideStaging.lookup("customer")).toBe("unavailable");
    await expect(
      outsideStaging.startCheckout("customer", ["GP-2026-118452"]),
    ).rejects.toThrow("identity_required");
  });

  it("returns synthetic results and refuses non-payable notices", async () => {
    const adapter = sandboxAdapter(env, auth("approved"));
    expect(await adapter.lookup("customer")).toMatchObject({
      fines: [{ id: "GP-2026-118452" }, { id: "GP-2026-123817" }],
    });
    expect(
      await sandboxAdapter(env, auth("approved"), "empty").lookup("customer"),
    ).toMatchObject({ fines: [] });
    expect(
      await sandboxAdapter(env, auth("approved"), "unavailable").lookup(
        "customer",
      ),
    ).toBe("unavailable");
    expect(parseScenario("unknown")).toBe("sample");
    await expect(
      adapter.startCheckout("customer", ["GP-2026-123817"]),
    ).rejects.toThrow("invalid_fines_checkout");
  });

  it("verifies the callback signature and rejects a modified body", async () => {
    const adapter = sandboxAdapter(env, auth("approved"));
    const signed = await sandboxCallbackRequest(env, origin, event);
    const tampered = new Request(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: (await signed.clone().text()).replace("paid", "failed"),
    });
    expect(await adapter.verifyCallback(signed)).toEqual(event);
    expect(await adapter.verifyCallback(tampered)).toBeNull();
  });
});
