import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { termsUrl } from "./session.server";
import {
  parseTermsStatus,
  readTermsState,
  termsGateAllows,
} from "./terms-gate.server";

/** A fake client whose my_terms_status() call returns or throws what we pass. */
function fakeSupabase(
  reply: { data: unknown; error: unknown } | Error,
): SupabaseClient {
  return {
    rpc: vi.fn(() =>
      reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply),
    ),
  } as unknown as SupabaseClient;
}

describe("termsGateAllows", () => {
  it("blocks only a pending account, and only outside the exempt pages", () => {
    expect(termsGateAllows("/provider", "pending")).toBe(false);
    expect(termsGateAllows("/account/profile", "pending")).toBe(false);
    expect(termsGateAllows("/auth/terms", "pending")).toBe(true);
    expect(termsGateAllows("/auth/sign-out", "pending")).toBe(true);
    expect(termsGateAllows("/account/closing", "pending")).toBe(true);
  });

  it("never blocks an accepted account or an unreadable status (fail open)", () => {
    expect(termsGateAllows("/provider", "accepted")).toBe(true);
    expect(termsGateAllows("/provider", "unknown")).toBe(true);
  });
});

describe("parseTermsStatus", () => {
  it("reads the row my_terms_status() returns, as a row or an array", () => {
    expect(
      parseTermsStatus({
        data: [
          { accepted: true, version: "account-terms-v1", accepted_at: "x" },
        ],
        error: null,
      }),
    ).toBe("accepted");
    expect(
      parseTermsStatus({
        data: [{ accepted: false, version: null }],
        error: null,
      }),
    ).toBe("pending");
    expect(parseTermsStatus({ data: { accepted: false }, error: null })).toBe(
      "pending",
    );
  });

  it("treats an error, an empty reply or an odd shape as unknown, never pending", () => {
    expect(parseTermsStatus({ data: null, error: { code: "42883" } })).toBe(
      "unknown",
    );
    expect(parseTermsStatus({ data: [], error: null })).toBe("unknown");
    expect(parseTermsStatus({ data: [{ accepted: "no" }], error: null })).toBe(
      "unknown",
    );
    expect(parseTermsStatus({ data: "accepted", error: null })).toBe("unknown");
  });
});

describe("readTermsState", () => {
  it("returns the state the RPC reports", async () => {
    const accepted = fakeSupabase({
      data: [{ accepted: true }],
      error: null,
    });
    const pending = fakeSupabase({ data: [{ accepted: false }], error: null });
    expect(await readTermsState(accepted)).toBe("accepted");
    expect(await readTermsState(pending)).toBe("pending");
  });

  it("fails open and logs when the RPC returns an error (staging before the migration)", async () => {
    const log = vi.fn();
    const state = await readTermsState(
      fakeSupabase({
        data: null,
        error: { message: "function does not exist" },
      }),
      log,
    );
    expect(state).toBe("unknown");
    expect(termsGateAllows("/provider", state)).toBe(true);
    expect(log).toHaveBeenCalledWith("terms status unavailable");
  });

  it("fails open and logs when the call throws, so the page is never a 500", async () => {
    const log = vi.fn();
    const state = await readTermsState(
      fakeSupabase(new Error("network down")),
      log,
    );
    expect(state).toBe("unknown");
    expect(termsGateAllows("/account/profile", state)).toBe(true);
    expect(log).toHaveBeenCalledWith("terms status unavailable");
  });

  it("does not log for a healthy read", async () => {
    const log = vi.fn();
    await readTermsState(
      fakeSupabase({ data: [{ accepted: true }], error: null }),
      log,
    );
    expect(log).not.toHaveBeenCalled();
  });
});

describe("termsUrl (where a pending person is sent)", () => {
  const origin = "https://carworx.app";

  it("keeps a GET's own address as returnTo, so accepting brings them back", () => {
    const url = termsUrl(
      new Request("https://carworx.app/provider?tab=1"),
      origin,
    );
    expect(url).toBe("/auth/terms?returnTo=%2Fprovider%3Ftab%3D1");
  });

  it("sends a POST to the consent page with no returnTo", () => {
    const url = termsUrl(
      new Request("https://carworx.app/account/photo", { method: "POST" }),
      origin,
    );
    expect(url).toBe("/auth/terms");
  });

  it("uses an explicit returnTo for a POST (an invite returns to /join)", () => {
    const url = termsUrl(
      new Request("https://carworx.app/join", { method: "POST" }),
      origin,
      "/join",
    );
    expect(url).toBe("/auth/terms?returnTo=%2Fjoin");
  });
});
