import { describe, expect, it, vi } from "vitest";
import { googleButton } from "./google.server";
import {
  consumeGoogleNonce,
  type LimiterNamespace,
} from "../server/search/limiter";

describe("Google button", () => {
  it("enables the Identity Services script only for a configured client and returns a hashed nonce", async () => {
    const headers = new Headers();
    expect(await googleButton({}, headers)).toBeNull();
    expect(headers.getSetCookie()).toEqual([]);
    const settings = {
      GOOGLE_WEB_CLIENT_ID: "123456-synthetic.apps.googleusercontent.com",
    };
    const config = await googleButton(settings, headers);
    expect(config?.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(headers.getSetCookie()[0]).toContain("__Host-cx-google-nonce=");
    expect(headers.getSetCookie()[0]).not.toContain(config?.nonce);
    expect(headers.get("Content-Security-Policy")).toContain(
      "https://accounts.google.com/gsi/client",
    );
  });

  it("fails closed when the nonce has already been consumed or the limiter is missing", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    fetch.mockResolvedValueOnce(Response.json({ allowed: true }));
    fetch.mockResolvedValueOnce(
      Response.json({ allowed: false, retry_after: 200 }),
    );
    const idFromName = vi.fn<(name: string) => string>((name) => name);
    const namespace: LimiterNamespace = { idFromName, get: () => ({ fetch }) };
    const nonce = "a".repeat(43);
    expect(await consumeGoogleNonce(namespace, nonce)).toBe(true);
    expect(await consumeGoogleNonce(namespace, nonce)).toBe(false);
    expect(await consumeGoogleNonce(undefined, nonce)).toBe(false);
    expect(idFromName.mock.calls[0]?.[0]).toMatch(
      /^google-nonce:[a-f0-9]{64}$/,
    );
    expect(idFromName.mock.calls[0]?.[0]).not.toContain(nonce);
  });
});
