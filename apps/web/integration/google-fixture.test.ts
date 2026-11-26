import { describe, expect, it, vi } from "vitest";

import {
  APP,
  Browser,
  createConfirmedUser,
  PASSWORD,
  sqlRows,
  stack,
  workerEnv,
} from "./harness";

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
      form: { intent: "google", consent: "on", returnTo: "/account" },
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
  it("requires signup consent and keeps the application destination on cancellation", async () => {
    const browser = new Browser();
    await browser.send("/auth/sign-up");
    const rejected = await browser.send("/auth/sign-up", {
      form: { intent: "google", returnTo: "/provider/get-listed/business" },
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body).toContain('data-problem="consent_required"');
    const started = await browser.send("/auth/sign-up", {
      form: {
        intent: "google",
        consent: "on",
        returnTo: "/provider/get-listed/business",
      },
    });
    expect(started.status).toBe(302);
    const cancelled = await browser.send("/auth/callback?error=access_denied");
    expect(cancelled.location).toBe(
      "/auth/sign-up?error=oauth_denied&returnTo=%2Fprovider%2Fget-listed%2Fbusiness",
    );
  });

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
      form: { intent: "google", consent: "on", returnTo: "" },
    });
    const victim = new Browser(); // has no verifier cookie
    const reply = await victim.send(
      "/auth/callback?code=00000000-0000-4000-8000-000000000001",
    );
    expect(reply.location).toBe("/auth/sign-in?error=oauth_failed");
    expect(victim.sessionCookieNames()).toEqual([]);
  });

  it("refuses Google sign-in until the terms box is ticked (B-10)", async () => {
    const browser = new Browser();
    await browser.send("/auth/sign-in");
    const refused = await browser.send("/auth/sign-in", {
      form: { intent: "google", returnTo: "/account" },
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toContain('data-problem="consent_required"');
  });

  it("only offers a CSRF-protected POST to start Google sign-in", async () => {
    const page = await new Browser().send("/auth/sign-in");
    // Attribute order is not part of the contract: match method="post" anywhere in the tag.
    const googleForm =
      /<form\b[^>]*\bmethod="post"[^>]*>[\s\S]*?<\/form>/.exec(
        page.body,
      )?.[0] ?? "";
    expect(googleForm).toMatch(
      /<button\b(?=[^>]*\bname="intent")(?=[^>]*\bvalue="google")[^>]*>/,
    );
    expect(googleForm).toContain('name="csrf"');
    const forged = new Browser();
    await forged.send("/auth/sign-in");
    const reply = await forged.send("/auth/sign-in", {
      form: { intent: "google" },
      origin: "https://evil.example",
    });
    expect(reply.status).toBe(403);
  });
});

// Fake only Google's exchange. The session and consent write use local Supabase.
describe("Google account terms", () => {
  it.each([
    ["pkce", true, false, "1"],
    ["pkce", false, false, "0"],
    ["id_token", true, false, "1"],
    ["id_token", false, false, "0"],
    ["pkce", true, true, "0"],
    ["id_token", true, true, "0"],
  ] as const)(
    "Google %s with consent=%s and closing=%s records %s consent rows",
    async (grant, consent, closing, count) => {
      const user = await createConfirmedUser("google-terms");
      if (closing) {
        sqlRows(
          `insert into private.account_closures (user_id) values ('${user.id}')`,
        );
      }
      const realFetch = globalThis.fetch;
      const session = await realFetch(
        `${stack.apiUrl}/auth/v1/token?grant_type=password`,
        {
          method: "POST",
          headers: {
            apikey: stack.anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: user.email, password: PASSWORD }),
        },
      );
      expect(session.status).toBe(200);
      const browser = new Browser({
        ...workerEnv,
        GOOGLE_WEB_CLIENT_ID: "123-synthetic.apps.googleusercontent.com",
        SEARCH_LIMITER: {
          idFromName: (name: string) => name,
          get: () => ({
            fetch: () => Promise.resolve(Response.json({ allowed: true })),
          }),
        },
      });
      const exchange = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((input, init) => {
          const url = new URL(input instanceof Request ? input.url : input);
          if (
            url.origin === stack.apiUrl &&
            url.pathname === "/auth/v1/token" &&
            url.searchParams.get("grant_type") === grant
          )
            return Promise.resolve(session.clone());
          return realFetch(input, init);
        });
      try {
        await browser.send("/auth/sign-in");
        if (grant === "pkce") {
          const start = await browser.send("/auth/sign-in", {
            form: { intent: "google", consent: "on", returnTo: "/account" },
          });
          expect(start.status).toBe(302);
          if (!consent) browser.jar.delete("__Host-cx-google-terms");
          const callback = await browser.send(
            "/auth/callback?code=synthetic-code",
          );
          expect(callback.status).toBe(302);
          expect(callback.location).toBe("/account");
        } else {
          const reply = await browser.send("/auth/sign-in", {
            form: {
              intent: "google-id",
              googleCredential: "synthetic.token.signature",
              returnTo: "/account",
              ...(consent ? { consent: "on" } : {}),
            },
          });
          if (consent) {
            expect(reply.status).toBe(302);
            expect(reply.location).toBe("/account");
          } else expect(reply.status).toBe(400);
        }
        if (closing) {
          const account = await browser.send("/account");
          expect(account.status).toBe(302);
          expect(account.location).toBe("/account/closing");
          const page = await browser.send("/account/closing");
          expect(page.status).toBe(200);
          expect(page.body).toContain("Reinstate my account");
        }
        expect(
          sqlRows(
            `select count(*) from public.consents where user_id = '${user.id}' and purpose = 'account_terms'`,
          ),
        ).toEqual([count]);
      } finally {
        exchange.mockRestore();
      }
    },
  );
});
