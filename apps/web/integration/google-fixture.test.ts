import { describe, expect, it } from "vitest";

import { APP, Browser, stack } from "./harness";

// FIXTURE-ONLY Google tests (Claude 10 B1, PLAN §11 A3). No Google client,
// no Google account and no Google network call: these check the app's side
// of the contract (redirect, PKCE, scopes, callback errors and session
// handling). A3's Google path does NOT pass on these; the real sign-in,
// code exchange, logout, both linking directions and denied consent need
// the owner's client and local redirect (owner guide 4).

describe("FIXTURE Google sign-in: the redirect the app starts", () => {
  it("sends the browser to Supabase's authorize endpoint with PKCE and basic scopes only", async () => {
    const browser = new Browser();
    await browser.send("/auth/sign-in");
    const reply = await browser.send("/auth/sign-in", {
      form: { intent: "google", returnTo: "/account" },
    });
    expect(reply.status).toBe(302);
    const location = new URL(reply.location ?? "");
    expect(location.origin).toBe(stack.apiUrl);
    expect(location.pathname).toBe("/auth/v1/authorize");
    expect(location.searchParams.get("provider")).toBe("google");
    expect(location.searchParams.get("redirect_to")).toBe(
      `${APP}/auth/callback`,
    );
    expect(new Set(location.searchParams.get("scopes")?.split(" "))).toEqual(
      new Set(["openid", "email", "profile"]),
    );
    expect(location.searchParams.get("code_challenge_method")).toBe("s256");
    expect(location.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    // The PKCE verifier and return path stay in HttpOnly __Host- cookies.
    expect(
      [...browser.jar.keys()].some((k) =>
        k.startsWith("__Host-cx-auth-code-verifier"),
      ),
    ).toBe(true);
    expect(browser.jar.get("__Host-cx-return")).toBe("/account");
    expect(browser.sessionCookieNames()).toEqual([]);
  });
});

describe("FIXTURE Google sign-in: callback outcomes", () => {
  it("turns denied consent into a recoverable sign-in state", async () => {
    const browser = new Browser();
    const reply = await browser.send(
      "/auth/callback?error=access_denied&error_description=The+user+denied",
    );
    expect(reply.status).toBe(302);
    expect(reply.location).toBe("/auth/sign-in?error=oauth_denied");
    const page = await browser.send(reply.location ?? "");
    expect(page.status).toBe(200);
    expect(page.body).toContain('data-problem="oauth_denied"');
    expect(page.body).toContain("Continue with Google");
    // The provider's description is never echoed.
    expect(page.body).not.toContain("The user denied");
  });

  it.each([
    ["a provider error", "/auth/callback?error=server_error"],
    ["no code", "/auth/callback"],
    [
      "an unknown code",
      "/auth/callback?code=00000000-0000-4000-8000-000000000000",
    ],
  ])(
    "fails safely with %s: no session, recoverable page",
    async (_label, path) => {
      const browser = new Browser();
      const reply = await browser.send(path);
      expect(reply.status).toBe(302);
      expect(reply.location).toBe("/auth/sign-in?error=oauth_failed");
      expect(browser.sessionCookieNames()).toEqual([]);
      expect((await browser.send(reply.location ?? "")).body).toContain(
        'data-problem="oauth_failed"',
      );
    },
  );

  it("refuses a code from a browser that didn't start the flow (no PKCE verifier)", async () => {
    const starter = new Browser();
    await starter.send("/auth/sign-in");
    await starter.send("/auth/sign-in", {
      form: { intent: "google", returnTo: "" },
    });
    const victim = new Browser(); // has no verifier cookie
    const reply = await victim.send(
      "/auth/callback?code=00000000-0000-4000-8000-000000000001",
    );
    expect(reply.location).toBe("/auth/sign-in?error=oauth_failed");
    expect(victim.sessionCookieNames()).toEqual([]);
  });

  it("only offers a CSRF-protected POST to start Google sign-in", async () => {
    const page = await new Browser().send("/auth/sign-in");
    expect(page.body).toMatch(
      /<form method="post"[^>]*>[\s\S]*?name="intent" value="google"/,
    );
    const forged = new Browser();
    await forged.send("/auth/sign-in");
    const reply = await forged.send("/auth/sign-in", {
      form: { intent: "google" },
      origin: "https://evil.example",
    });
    expect(reply.status).toBe(403);
  });
});
