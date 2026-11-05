import { describe, expect, it } from "vitest";

import { APP, Browser, createConfirmedUser, PASSWORD, signIn } from "./harness";

// T5 (issue #9) through the real routes: the production Worker build, the
// real auth actions and local Supabase.

function expectAppCookieFlags(setCookies: string[]) {
  expect(setCookies.length).toBeGreaterThan(0);
  for (const header of setCookies) {
    expect(header).toMatch(/^__Host-cx-/);
    expect(header).toMatch(/;\s*Secure(;|$)/i);
    expect(header).toMatch(/;\s*HttpOnly(;|$)/i);
    expect(header).toMatch(/;\s*SameSite=Lax(;|$)/i);
    expect(header).toMatch(/;\s*Path=\/(;|$)/i);
    expect(header).not.toMatch(/;\s*Domain=/i);
  }
}

describe("CSRF and Origin checks on the sign-in and sign-out mutations", () => {
  it("issues the CSRF cookie with strict flags and renders the token in the forms", async () => {
    const browser = new Browser();
    const page = await browser.send("/auth/sign-in");
    expect(page.status).toBe(200);
    expectAppCookieFlags(page.setCookies);
    expect(page.body).toContain(`name="csrf" value="${browser.csrf()}"`);
  });

  it.each([
    ["a hostile Origin", { origin: "https://evil.example" }],
    ["a missing Origin", { origin: null }],
    ["a sibling-subdomain Origin", { origin: "http://evil.localhost:5173" }],
    [
      "a cross-site Sec-Fetch-Site",
      { headers: { "Sec-Fetch-Site": "cross-site" } },
    ],
  ])(
    "refuses a sign-in post with %s (403, no session)",
    async (_label, init) => {
      const user = await createConfirmedUser("origin");
      const browser = new Browser();
      await browser.send("/auth/sign-in");
      const reply = await browser.send("/auth/sign-in", {
        ...init,
        form: {
          intent: "password",
          email: user.email,
          password: PASSWORD,
        },
      });
      expect(reply.status).toBe(403);
      expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
      expect(browser.sessionCookieNames()).toEqual([]);
    },
  );

  it("refuses a post with no CSRF token, or a token that doesn't match the cookie", async () => {
    const user = await createConfirmedUser("csrf");
    const browser = new Browser();
    await browser.send("/auth/sign-in");
    const form = {
      intent: "password",
      email: user.email,
      password: PASSWORD,
    };
    expect(
      (await browser.send("/auth/sign-in", { form, csrf: false })).status,
    ).toBe(403);
    expect(
      (
        await browser.send("/auth/sign-in", {
          form: { ...form, csrf: "x".repeat(43) },
        })
      ).status,
    ).toBe(403);
    // An attacker's page has its own token but not the victim's cookie.
    const attacker = new Browser();
    await attacker.send("/auth/sign-in");
    expect(
      (
        await browser.send("/auth/sign-in", {
          form: { ...form, csrf: attacker.csrf() },
        })
      ).status,
    ).toBe(403);
    expect(browser.sessionCookieNames()).toEqual([]);
  });

  it("refuses a cross-site sign-out, and the session keeps working", async () => {
    const user = await createConfirmedUser("signout-csrf");
    const browser = await signIn(user.email);
    const forged = await browser.send("/auth/sign-out", {
      form: {},
      origin: "https://evil.example",
    });
    expect(forged.status).toBe(403);
    expect((await browser.send("/account")).status).toBe(200);
  });
});

describe("redirect allowlist on returnTo", () => {
  it.each([
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example",
    "/%2F%2Fevil.example",
    "javascript:alert(1)",
    "/auth/sign-out",
  ])("ignores returnTo=%j after sign-in", async (returnTo) => {
    const user = await createConfirmedUser("redirect");
    const browser = new Browser();
    await browser.send("/auth/sign-in");
    const reply = await browser.send("/auth/sign-in", {
      form: {
        intent: "password",
        email: user.email,
        password: PASSWORD,
        returnTo,
      },
    });
    expect(reply.status).toBe(302);
    expect(reply.location).toBe("/account");
  });

  it("follows an allowed returnTo", async () => {
    const user = await createConfirmedUser("redirect-ok");
    const browser = new Browser();
    await browser.send("/auth/sign-in");
    const reply = await browser.send("/auth/sign-in", {
      form: {
        intent: "password",
        email: user.email,
        password: PASSWORD,
        returnTo: "/account?tab=organisations",
      },
    });
    expect(reply.location).toBe("/account?tab=organisations");
  });

  it("ignores a forged return cookie on the OAuth callback", async () => {
    const browser = new Browser();
    browser.jar.set("__Host-cx-return", "https://evil.example/");
    const reply = await browser.send("/auth/callback?error=access_denied");
    expect(reply.location).toBe("/auth/sign-in?error=oauth_denied");
    const signedIn = await signIn(
      (await createConfirmedUser("return-cookie")).email,
    );
    signedIn.jar.set("__Host-cx-return", "//evil.example");
    // With a session but no code the callback still cannot redirect off-site.
    const noCode = await signedIn.send("/auth/callback");
    expect(noCode.location).toBe("/auth/sign-in?error=oauth_failed");
  });

  it("sends a signed-out user to sign in with a checked returnTo", async () => {
    const reply = await new Browser().send("/admin");
    expect(reply.status).toBe(302);
    expect(reply.location).toBe("/auth/sign-in?returnTo=%2Fadmin");
  });
});

describe("session cookies and server-side validation", () => {
  it("sets only Secure, HttpOnly, SameSite=Lax, __Host- session cookies", async () => {
    const user = await createConfirmedUser("flags");
    const browser = new Browser();
    await browser.send("/auth/sign-in");
    const reply = await browser.send("/auth/sign-in", {
      form: {
        intent: "password",
        email: user.email,
        password: PASSWORD,
      },
    });
    expect(reply.status).toBe(302);
    expect(reply.setCookies.some((c) => c.startsWith("__Host-cx-auth"))).toBe(
      true,
    );
    expectAppCookieFlags(reply.setCookies);
  });

  it("rejects a forged session cookie (never trusts the cookie alone)", async () => {
    const browser = new Browser();
    const fakeJwt = [
      Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
      Buffer.from(
        JSON.stringify({
          sub: "00000000-0000-4000-8000-000000000000",
          role: "authenticated",
          aal: "aal2",
          exp: 4102444800,
        }),
      ).toString("base64url"),
      "forged-signature",
    ].join(".");
    const session = {
      access_token: fakeJwt,
      refresh_token: "forged",
      expires_at: 4102444800,
      token_type: "bearer",
      user: { id: "00000000-0000-4000-8000-000000000000" },
    };
    browser.jar.set(
      "__Host-cx-auth",
      `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`,
    );
    const reply = await browser.send("/account");
    expect(reply.status).toBe(302);
    expect(reply.location).toBe("/auth/sign-in?returnTo=%2Faccount");
  });

  it("rejects a real session whose token was tampered with", async () => {
    const user = await createConfirmedUser("tamper");
    const browser = await signIn(user.email);
    const session = browser.session();
    const [h, p, s = ""] = session.access_token.split(".");
    const claims = JSON.parse(
      Buffer.from(p ?? "", "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    claims["aal"] = "aal2";
    const tampered = [
      h,
      Buffer.from(JSON.stringify(claims)).toString("base64url"),
      s,
    ].join(".");
    for (const name of browser.sessionCookieNames()) browser.jar.delete(name);
    browser.jar.set(
      "__Host-cx-auth",
      `base64-${Buffer.from(JSON.stringify({ ...session, access_token: tampered, refresh_token: "x" })).toString("base64url")}`,
    );
    expect((await browser.send("/account")).status).toBe(302);
  });

  it("stops a copied session cookie working after sign-out", async () => {
    const user = await createConfirmedUser("replay");
    const browser = await signIn(user.email);
    const copy = new Browser();
    for (const [k, v] of browser.jar) copy.jar.set(k, v);
    const out = await browser.send("/auth/sign-out", { form: {} });
    expect(out.status).toBe(302);
    expect(out.location).toBe("/");
    expect(browser.sessionCookieNames()).toEqual([]);
    const replay = await copy.send("/account");
    expect(replay.status).toBe(302);
    expect(replay.location).toBe("/auth/sign-in?returnTo=%2Faccount");
  });

  it("signs nobody out on GET /auth/sign-out", async () => {
    const user = await createConfirmedUser("get-signout");
    const browser = await signIn(user.email);
    const reply = await browser.send("/auth/sign-out");
    expect(reply.status).toBe(302);
    expect((await browser.send("/account")).status).toBe(200);
  });
});

describe("personal responses are never cacheable", () => {
  it("marks every auth page, personal page, data request and redirect private, no-store", async () => {
    const user = await createConfirmedUser("nostore");
    const browser = await signIn(user.email);
    const paths = [
      "/account",
      "/account.data",
      "/auth/sign-in",
      "/auth/sign-up",
      "/auth/forgot-password",
      "/auth/check-email",
      "/auth/mfa",
      "/admin",
      "/org/00000000-0000-4000-8000-000000000000",
      "/",
    ];
    for (const path of paths) {
      const reply = await browser.send(path);
      expect(reply.headers.get("Cache-Control"), path).toBe(
        "private, no-store",
      );
    }
    const anonymous = await new Browser().send("/auth/sign-in");
    expect(anonymous.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("adds the baseline security headers to pages", async () => {
    const reply = await new Browser().send("/auth/sign-in");
    expect(reply.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(reply.headers.get("X-Frame-Options")).toBe("DENY");
    expect(reply.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(reply.headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it("leaves /healthz as it was", async () => {
    const reply = await new Browser().send("/healthz");
    expect(reply.status).toBe(200);
    expect(reply.headers.get("Cache-Control")).toBe("no-store");
    expect(new URL(APP).origin).toBe(APP);
  });
});
