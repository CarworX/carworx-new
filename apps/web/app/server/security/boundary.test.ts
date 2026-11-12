import { describe, expect, it, vi } from "vitest";

import {
  checkMutation,
  finalizeResponse,
  MAX_FORM_BYTES,
  withSecurityBoundary,
} from "./boundary";
import { CSRF_COOKIE, serializeAppCookie } from "./cookies";

// Unit tests of the boundary with a stand-in app. The same checks run
// through the real routes and local Supabase in integration/.

const APP = "http://localhost:5173";
const env = {
  APP_ORIGIN: APP,
  SUPABASE_URL: "http://127.0.0.1:54321",
  SUPABASE_PUBLISHABLE_KEY: "unit-test-publishable-key-not-a-secret",
};
const TOKEN = "a".repeat(43);

function post(init: {
  origin?: string | null;
  cookie?: string;
  body?: string;
  type?: string;
  site?: string;
}): Request {
  const headers = new Headers({
    "Content-Type": init.type ?? "application/x-www-form-urlencoded",
  });
  if (init.origin !== null) headers.set("Origin", init.origin ?? APP);
  if (init.cookie !== undefined) headers.set("Cookie", init.cookie);
  if (init.site !== undefined) headers.set("Sec-Fetch-Site", init.site);
  return new Request(`${APP}/auth/sign-in`, {
    method: "POST",
    headers,
    body: init.body ?? `csrf=${TOKEN}&email=a%40example.test`,
  });
}

const goodCookie = `${CSRF_COOKIE}=${TOKEN}`;

async function run(request: Request, response = new Response("ok")) {
  const app = vi.fn(() => Promise.resolve(response));
  const result = await withSecurityBoundary(request, env, app);
  return { result, called: app.mock.calls.length > 0 };
}

describe("mutation checks", () => {
  it("lets a same-origin form post with a matching CSRF token through", async () => {
    const { result, called } = await run(post({ cookie: goodCookie }));
    expect(called).toBe(true);
    expect(result.status).toBe(200);
  });

  it.each([
    [
      "a hostile Origin",
      { origin: "https://evil.example", cookie: goodCookie },
    ],
    ["a missing Origin", { origin: null, cookie: goodCookie }],
    // An opaque origin stays refused even with a valid CSRF token: the
    // no-JS fix is the referrer policy, never a weaker Origin check.
    ["a literal Origin: null", { origin: "null", cookie: goodCookie }],
    [
      "a look-alike Origin",
      { origin: "http://localhost:5173.evil.example", cookie: goodCookie },
    ],
    ["a cross-site fetch", { cookie: goodCookie, site: "cross-site" }],
    ["no CSRF cookie", {}],
    ["a mismatched CSRF token", { cookie: `${CSRF_COOKIE}=${"b".repeat(43)}` }],
    ["no CSRF field", { cookie: goodCookie, body: "email=a%40example.test" }],
    [
      "a JSON body",
      {
        cookie: goodCookie,
        type: "application/json",
        body: `{"csrf":"${TOKEN}"}`,
      },
    ],
  ])("refuses %s with 403 before the app runs", async (_name, init) => {
    const { result, called } = await run(post(init));
    expect(result.status).toBe(403);
    expect(called).toBe(false);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("refuses oversized forms", async () => {
    const big = `csrf=${TOKEN}&x=${"y".repeat(MAX_FORM_BYTES)}`;
    const { result, called } = await run(
      post({ cookie: goodCookie, body: big }),
    );
    expect(result.status).toBe(403);
    expect(called).toBe(false);
  });

  it("refuses every mutation when Auth settings are missing, but still serves pages", async () => {
    const app = vi.fn(() => Promise.resolve(new Response("page")));
    const refused = await withSecurityBoundary(
      post({ cookie: goodCookie }),
      {},
      app,
    );
    expect(refused.status).toBe(500);
    expect(app).not.toHaveBeenCalled();
    const page = await withSecurityBoundary(new Request(`${APP}/`), {}, app);
    expect(page.status).toBe(200);
  });
});

describe("response finalisation", () => {
  const config = {
    environment: "local" as const,
    approvedRecipients: null,
    appOrigin: APP,
    supabaseUrl: env.SUPABASE_URL,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
  };

  it("forces private, no-store when the request carries an app cookie", () => {
    const request = new Request(`${APP}/`, { headers: { Cookie: goodCookie } });
    const response = new Response("x", {
      headers: { "Cache-Control": "public, max-age=600" },
    });
    expect(
      finalizeResponse(request, response, config).headers.get("Cache-Control"),
    ).toBe("private, no-store");
  });

  it.each([
    ["/join", "same-origin"],
    ["/join/opaque-invite", "no-referrer"],
    ["/provider", "same-origin"],
    ["/provider/setup/team/role", "same-origin"],
  ])(
    "never caches personal path %s or sends its URL to another site",
    (path, policy) => {
      const response = finalizeResponse(
        new Request(`${APP}${path}`),
        new Response("x", {
          headers: { "Cache-Control": "public, max-age=600" },
        }),
        config,
      );
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      // The invite-token URL sends no referrer at all; other personal pages
      // send one only to this origin, so no-JS form posts keep a real Origin.
      expect(response.headers.get("Referrer-Policy")).toBe(policy);
    },
  );

  it("forces private, no-store on personal paths and when no policy was set", () => {
    const personal = finalizeResponse(
      new Request(`${APP}/account`),
      new Response("x", {
        headers: { "Cache-Control": "public, max-age=600" },
      }),
      config,
    );
    expect(personal.headers.get("Cache-Control")).toBe("private, no-store");
    const unset = finalizeResponse(
      new Request(`${APP}/`),
      new Response("x"),
      config,
    );
    expect(unset.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("keeps an explicit policy for an anonymous, cookie-free public response", () => {
    const response = finalizeResponse(
      new Request(`${APP}/healthz`),
      new Response("x", { headers: { "Cache-Control": "no-store" } }),
      config,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("fails closed on a cookie without the required flags", () => {
    const response = new Response("x");
    response.headers.append("Set-Cookie", "sb-access-token=abc; Path=/");
    expect(
      finalizeResponse(new Request(`${APP}/`), response, config).status,
    ).toBe(500);
  });

  it("allows app cookies built by serializeAppCookie", () => {
    const response = new Response("x");
    response.headers.append(
      "Set-Cookie",
      serializeAppCookie("__Host-cx-auth", "v"),
    );
    expect(
      finalizeResponse(new Request(`${APP}/`), response, config).status,
    ).toBe(200);
  });

  it.each([
    "https://evil.example/",
    "//evil.example/",
    "http://127.0.0.1:54321/auth/v1/admin/users",
  ])("fails closed on a redirect to %s", (location) => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: location },
    });
    expect(
      finalizeResponse(new Request(`${APP}/`), response, config).status,
    ).toBe(500);
  });

  it("allows same-origin redirects and the Supabase authorize endpoint", () => {
    for (const location of [
      "/account",
      `${env.SUPABASE_URL}/auth/v1/authorize?provider=google`,
    ]) {
      const response = new Response(null, {
        status: 302,
        headers: { Location: location },
      });
      expect(
        finalizeResponse(new Request(`${APP}/`), response, config).status,
      ).toBe(302);
    }
  });

  it("adds the baseline security headers", () => {
    const headers = finalizeResponse(
      new Request(`${APP}/auth/sign-in`),
      new Response("x"),
      config,
    ).headers;
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("Referrer-Policy")).toBe("same-origin");
    expect(headers.get("Content-Security-Policy")).toContain(
      "frame-ancestors 'none'",
    );
  });

  it.each(["/auth/sign-in", "/account", "/admin/support", "/org", "/org/team"])(
    "%s keeps referrers same-origin, so native form posts carry a real Origin",
    (path) => {
      const policy = finalizeResponse(
        new Request(`${APP}${path}`),
        new Response("x"),
        config,
      ).headers.get("Referrer-Policy");
      // never no-referrer: Chromium then sends `Origin: null` on form posts.
      expect(policy).toBe("same-origin");
    },
  );

  it.each(["/", "/search", "/p/abc", "/fines"])(
    "%s keeps the public default referrer policy",
    (path) => {
      expect(
        finalizeResponse(
          new Request(`${APP}${path}`),
          new Response("x"),
          config,
        ).headers.get("Referrer-Policy"),
      ).toBe("strict-origin-when-cross-origin");
    },
  );

  it("sets the CSRF cookie only on HTML responses", async () => {
    const html = await withSecurityBoundary(
      new Request(`${APP}/auth/sign-in`),
      env,
      () =>
        Promise.resolve(
          new Response("<p>", { headers: { "Content-Type": "text/html" } }),
        ),
    );
    expect(
      html.headers.getSetCookie().some((c) => c.startsWith(`${CSRF_COOKIE}=`)),
    ).toBe(true);
    const json = await withSecurityBoundary(
      new Request(`${APP}/healthz`),
      env,
      () => Promise.resolve(Response.json({})),
    );
    expect(json.headers.getSetCookie()).toEqual([]);
  });
});

describe("mutation body handling (regressions)", () => {
  const config = {
    environment: "local" as const,
    approvedRecipients: null,
    appOrigin: APP,
    supabaseUrl: env.SUPABASE_URL,
    supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY,
  };

  it("accepts a multipart body whose case-sensitive boundary is mixed case", async () => {
    const boundary = "----WebKitFormBoundaryAbCdEf123456";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="csrf"',
      "",
      TOKEN,
      `--${boundary}`,
      'Content-Disposition: form-data; name="email"',
      "",
      "a@example.test",
      `--${boundary}--`,
      "",
    ].join("\r\n");
    const request = new Request(`${APP}/auth/sign-in`, {
      method: "POST",
      headers: {
        Origin: APP,
        Cookie: goodCookie,
        "Content-Type": `Multipart/Form-Data; boundary=${boundary}`,
      },
      body,
    });
    expect(await checkMutation(request, config)).toEqual({ ok: true });
  });

  it("stops reading an oversize body without Content-Length at the limit", async () => {
    const total = 1024 * 1024;
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= total) {
          controller.close();
          return;
        }
        const chunk = new Uint8Array(16 * 1024);
        pulled += chunk.byteLength;
        controller.enqueue(chunk);
      },
    });
    const request = new Request(`${APP}/auth/sign-in`, {
      method: "POST",
      headers: {
        Origin: APP,
        Cookie: goodCookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect(await checkMutation(request, config)).toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(pulled).toBeLessThan(total / 4);
  });
});
