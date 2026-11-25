import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { signedInDestination } from "./after-sign-in.server";

// Synthetic stub of the one query the helper makes. No network, no database.
function clientReturning(result: {
  data: { id: string }[] | null;
  error: unknown;
}) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    overrideTypes: () => Promise.resolve(result),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("signed-in destination (B-14)", () => {
  it("sends a business member to their business", async () => {
    const client = clientReturning({
      data: [{ id: "synthetic-membership" }],
      error: null,
    });
    expect(await signedInDestination(client)).toBe("/provider");
  });

  it("sends a customer with no membership to the home page", async () => {
    const client = clientReturning({ data: [], error: null });
    expect(await signedInDestination(client)).toBe("/");
  });

  it("falls back to the home page when the lookup fails", async () => {
    const client = clientReturning({ data: null, error: { code: "42501" } });
    expect(await signedInDestination(client)).toBe("/");
  });
});
