import { randomUUID } from "node:crypto";

import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from "vitest";

import { Browser, sql, sqlRows, stack, workerEnv } from "./harness";

/**
 * P2-5 visitor forms through the built Worker, writing as the real scoped
 * forms_server login (Claude 22). Turnstile uses Cloudflare's official test
 * keys, and siteverify is answered by a stub: nothing calls Cloudflare.
 * Every row a test writes is removed in onTestFinished (shared stack).
 */
const password = `synthetic-${randomUUID()}`;
const SEED_FIXED = "ca7c1000-0000-4000-8000-000000000001";
const SEED_PENDING = "ca7c1000-0000-4000-8000-000000000003";
const TAG = randomUUID().slice(0, 8);
// Cloudflare's published test pair (not secrets): troubleshooting/testing,
// read 2026-11-11. The same values as app/server/forms/turnstile.ts.
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TEST_SITE_KEY_PASS = "1x00000000000000000000AA";
const TEST_SECRET_PASS = "1x0000000000000000000000000000000AA";
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function login(): string {
  const url = new URL(stack.dbUrl);
  url.username = "forms_server";
  url.password = password;
  return url.toString();
}

/** In-memory stand-in for the limiter namespace (no workerd in this harness). */
function limiter(answer: unknown = { allowed: true }) {
  const names: string[] = [];
  return {
    names,
    idFromName: (name: string) => name,
    get: (name: unknown) => {
      names.push(String(name));
      return { fetch: () => Promise.resolve(Response.json(answer)) };
    },
  };
}

// --- siteverify stub ----------------------------------------------------------
const realFetch = globalThis.fetch;
let verifyAnswer: unknown = { success: true, hostname: "example.com" };
let verifyCalls: URLSearchParams[] = [];
beforeAll(() => {
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sql(`alter role forms_server password '${password}' valid until '${until}'`);
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === SITEVERIFY_URL) {
      // verifyTurnstile always sends a URLSearchParams body.
      verifyCalls.push(new URLSearchParams(init?.body as URLSearchParams));
      return Promise.resolve(Response.json(verifyAnswer));
    }
    if (url.startsWith("https://challenges.cloudflare.com"))
      return Promise.reject(new Error("unexpected Cloudflare call"));
    return realFetch(input, init);
  };
});
afterEach(() => {
  verifyAnswer = { success: true, hostname: "example.com" };
  verifyCalls = [];
});
afterAll(() => {
  globalThis.fetch = realFetch;
  sql("alter role forms_server password null");
});

function browser(extra: Record<string, unknown> = {}) {
  return new Browser({
    ...workerEnv,
    SEARCH_LIMITER_SALT: `synthetic-salt-${randomUUID()}`,
    SEARCH_LIMITER: limiter(),
    FORMS_DB: { connectionString: login() },
    TURNSTILE_SITE_KEY: TEST_SITE_KEY_PASS,
    TURNSTILE_SECRET_KEY: TEST_SECRET_PASS,
    ...extra,
  } as unknown as typeof workerEnv & Record<string, string>);
}

function email(label: string) {
  return `forms-${label}-${TAG}-${randomUUID().slice(0, 6)}@example.test`;
}

/** Removes everything written with this address, consents included. */
function cleanUp(address: string) {
  onTestFinished(() => {
    sql(`
      delete from public.enquiries where sender_email = '${address}';
      delete from public.demand_requests where email = '${address}';
      delete from public.support_cases where email = '${address}';
      delete from public.consents where subject_email = '${address}';`);
  });
}

function count(table: string, column: string, value: string): number {
  return Number(
    sqlRows(
      `select count(*) from public.${table} where ${column} = '${value}'`,
    )[0],
  );
}

const enquiry = (address: string, extra: Record<string, string> = {}) => ({
  name: "Sam Sender",
  email: address,
  message: "Synthetic enquiry: do you do weekend washes?",
  consent: "on",
  "cf-turnstile-response": DUMMY_TOKEN,
  ...extra,
});

describe("enquiry on /p/:publicId", () => {
  it("renders the form with an unticked consent box and the widget slot", async () => {
    const reply = await browser().send(`/p/${SEED_FIXED}`);
    expect(reply.status).toBe(200);
    expect(reply.headers.get("Cache-Control")).toBe("private, no-store");
    expect(reply.body).toContain('data-form="enquiry"');
    expect(reply.body).toContain('data-human-check="enquiry"');
    const consent = /<input[^>]*name="consent"[^>]*>/.exec(reply.body)?.[0];
    expect(consent).toBeDefined();
    expect(consent).not.toMatch(/\bchecked\b/);
    // The sitekey reaches the client only as page data; the secret never does.
    expect(reply.body).toContain(TEST_SITE_KEY_PASS);
    expect(reply.body).not.toContain(TEST_SECRET_PASS);
  });

  it("stores an enquiry as forms_server after Turnstile passes", async () => {
    const address = email("enquiry");
    cleanUp(address);
    const b = browser();
    await b.send(`/p/${SEED_FIXED}`);
    const reply = await b.send(`/p/${SEED_FIXED}`, {
      form: enquiry(address.toUpperCase()),
      headers: { "CF-Connecting-IP": "198.51.100.7" },
    });
    expect(reply.status).toBe(302);
    expect(reply.location).toBe(`/p/${SEED_FIXED}?sent=1#enquiry`);
    expect(count("enquiries", "sender_email", address)).toBe(1);
    expect(
      sqlRows(
        `select c.purpose || '|' || c.method || '|' || c.notice_version from public.enquiries e join public.consents c on c.id = e.consent_id where e.sender_email = '${address}'`,
      ),
    ).toEqual([
      "enquiry_share_with_provider|checkbox_unticked_default|privacy-2026-11-11",
    ]);
    expect(verifyCalls).toHaveLength(1);
    expect(verifyCalls[0]?.get("secret")).toBe(TEST_SECRET_PASS);
    expect(verifyCalls[0]?.get("response")).toBe(DUMMY_TOKEN);
    expect(verifyCalls[0]?.get("remoteip")).toBe("198.51.100.7");
    const sent = await b.send(`/p/${SEED_FIXED}?sent=1`);
    expect(sent.body).toContain("Message sent.");
  });

  it("refuses without consent, before Turnstile and the database", async () => {
    const address = email("noconsent");
    cleanUp(address);
    const b = browser();
    await b.send(`/p/${SEED_FIXED}`);
    const reply = await b.send(`/p/${SEED_FIXED}`, {
      form: enquiry(address, { consent: "" }),
    });
    expect(reply.status).toBe(400);
    expect(reply.body).toContain('data-problem="consent_required"');
    expect(verifyCalls).toHaveLength(0);
    expect(count("consents", "subject_email", address)).toBe(0);
  });

  it("writes nothing when Turnstile fails", async () => {
    const address = email("botcheck");
    cleanUp(address);
    verifyAnswer = {
      success: false,
      "error-codes": ["invalid-input-response"],
    };
    const b = browser();
    await b.send(`/p/${SEED_FIXED}`);
    const reply = await b.send(`/p/${SEED_FIXED}`, { form: enquiry(address) });
    expect(reply.status).toBe(400);
    expect(reply.body).toContain('data-problem="check_failed"');
    expect(count("consents", "subject_email", address)).toBe(0);
  });

  it("refuses an enquiry to a listing that isn't live", async () => {
    const address = email("pending");
    cleanUp(address);
    const b = browser();
    await b.send(`/p/${SEED_FIXED}`);
    const reply = await b.send(`/p/${SEED_PENDING}`, {
      form: enquiry(address),
    });
    // The page itself is a 404, so the action never reaches the database
    // with a usable listing; either way nothing is stored.
    expect([404, 409]).toContain(reply.status);
    expect(count("consents", "subject_email", address)).toBe(0);
  });

  it("is limited per IP before anything else (429, Retry-After)", async () => {
    const address = email("limited");
    cleanUp(address);
    const ns = limiter({ allowed: false, retry_after: 42 });
    const b = browser({ SEARCH_LIMITER: ns });
    await b.send(`/p/${SEED_FIXED}`);
    const reply = await b.send(`/p/${SEED_FIXED}`, {
      form: enquiry(address),
      headers: { "CF-Connecting-IP": "198.51.100.7" },
    });
    expect(reply.status).toBe(429);
    expect(reply.headers.get("Retry-After")).toBe("42");
    expect(verifyCalls).toHaveLength(0);
    expect(ns.names).toHaveLength(1);
    expect(ns.names[0]).toMatch(/^form:enquiry:ip:[0-9a-f]{64}$/);
  });

  it("is closed without keys, and test keys are refused outside local", async () => {
    for (const env of [
      { TURNSTILE_SITE_KEY: undefined, TURNSTILE_SECRET_KEY: undefined },
      { CARWORX_ENV: "staging" },
    ]) {
      const address = email("closed");
      cleanUp(address);
      const b = browser(env);
      const page = await b.send(`/p/${SEED_FIXED}`);
      expect(page.body).toContain("available right now.");
      expect(page.body).not.toContain('data-form="enquiry"');
      const reply = await b.send(`/p/${SEED_FIXED}`, {
        form: enquiry(address),
      });
      expect(reply.status).toBe(503);
      expect(count("consents", "subject_email", address)).toBe(0);
    }
    expect(verifyCalls).toHaveLength(0);
  });

  it("fails closed without the forms database", async () => {
    const address = email("nodb");
    cleanUp(address);
    const b = browser({ FORMS_DB: undefined });
    await b.send(`/p/${SEED_FIXED}`);
    const reply = await b.send(`/p/${SEED_FIXED}`, { form: enquiry(address) });
    expect(reply.status).toBe(503);
  });

  it("refuses a cross-site post or a missing CSRF token (T5)", async () => {
    const address = email("csrf");
    cleanUp(address);
    const b = browser();
    await b.send(`/p/${SEED_FIXED}`);
    expect(
      (
        await b.send(`/p/${SEED_FIXED}`, {
          form: enquiry(address),
          origin: "https://evil.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await b.send(`/p/${SEED_FIXED}`, {
          form: enquiry(address),
          csrf: false,
        })
      ).status,
    ).toBe(403);
    expect(count("consents", "subject_email", address)).toBe(0);
  });
});

describe("demand capture (A13)", () => {
  const demand = (address: string, extra: Record<string, string> = {}) => ({
    email: address,
    category: "wash-and-detailing",
    province: "gauteng",
    consent: "on",
    "cf-turnstile-response": DUMMY_TOKEN,
    ...extra,
  });

  it("an empty search links to the demand form with the service", async () => {
    const until = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const catalogue = `synthetic-${randomUUID()}`;
    sql(
      `alter role catalogue_server password '${catalogue}' valid until '${until}'`,
    );
    onTestFinished(() => {
      sql("alter role catalogue_server password null");
    });
    const url = new URL(stack.dbUrl);
    url.username = "catalogue_server";
    url.password = catalogue;
    // Northern Cape interior: far from every seeded provider.
    const reply = await browser({
      SEARCH_CURSOR_KEY: `synthetic-cursor-${randomUUID()}`,
      CATALOGUE_DB: { connectionString: url.toString() },
    }).send(
      "/search?lat=-29.1&lng=21.1&radius=5&category=glass-repair-and-replacement",
    );
    expect(reply.status).toBe(200);
    expect(reply.body).toContain("No providers found here yet.");
    expect(reply.body).toContain(
      'href="/demand?category=glass-repair-and-replacement"',
    );
    // "No results" isn't "no providers": the copy says so.
    expect(reply.body).toContain("doesn&#x27;t mean there are none");
  });

  it("stores one private row per email, service and province", async () => {
    const address = email("demand");
    cleanUp(address);
    const b = browser();
    const page = await b.send("/demand?category=wash-and-detailing");
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.body).toContain('data-form="demand"');
    expect(page.body).not.toMatch(/name="(?:lat|lng|area)"/);
    for (let i = 0; i < 2; i++) {
      const reply = await b.send("/demand", { form: demand(address) });
      expect(reply.status).toBe(302);
      expect(reply.location).toBe("/demand?sent=1");
    }
    expect(count("demand_requests", "email", address)).toBe(1);
    expect(count("consents", "subject_email", address)).toBe(2);
  });

  it("is never readable or writable through the public API", async () => {
    const address = email("demand-api");
    cleanUp(address);
    const b = browser();
    await b.send("/demand");
    await b.send("/demand", { form: demand(address) });
    expect(count("demand_requests", "email", address)).toBe(1);
    const headers = {
      apikey: stack.anonKey,
      Authorization: `Bearer ${stack.anonKey}`,
      "Content-Type": "application/json",
    };
    for (const table of [
      "demand_requests",
      "consents",
      "enquiries",
      "support_cases",
    ]) {
      const read = await realFetch(
        `${stack.apiUrl}/rest/v1/${table}?select=*`,
        {
          headers,
        },
      );
      const text = await read.text();
      expect(read.ok && text !== "[]").toBe(false);
      expect(text).not.toContain(address);
    }
    const rpc = await realFetch(`${stack.apiUrl}/rest/v1/rpc/capture_demand`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_email: email("direct"),
        p_category: "wash-and-detailing",
        p_province: "gauteng",
        p_consent: true,
        p_notice: "privacy-2026-11-11",
      }),
    });
    expect(rpc.ok).toBe(false);
    await rpc.body?.cancel();
    // Nor is it anywhere on a public page.
    const listing = await browser().send(`/p/${SEED_FIXED}`);
    expect(listing.body).not.toContain(address);
  });

  it("refuses an unknown service and missing consent", async () => {
    const address = email("demand-bad");
    cleanUp(address);
    const b = browser();
    await b.send("/demand");
    const bad = await b.send("/demand", {
      form: demand(address, { category: "fines" }),
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toContain('data-problem="invalid_input"');
    const unticked = await b.send("/demand", {
      form: demand(address, { consent: "" }),
    });
    expect(unticked.body).toContain('data-problem="consent_required"');
    expect(count("consents", "subject_email", address)).toBe(0);
  });
});

describe("support case", () => {
  it("stores an open case", async () => {
    const address = email("support");
    cleanUp(address);
    const b = browser();
    const page = await b.send("/support");
    expect(page.body).toContain('data-form="support"');
    const reply = await b.send("/support", {
      form: {
        email: address,
        topic: "privacy_request",
        message: "Synthetic: please delete my demand request.",
        "cf-turnstile-response": DUMMY_TOKEN,
      },
    });
    expect(reply.status).toBe(302);
    expect(reply.location).toBe("/support?sent=1");
    expect(
      sqlRows(
        `select topic || '|' || status from public.support_cases where email = '${address}'`,
      ),
    ).toEqual(["privacy_request|open"]);
  });

  it("never puts a form body in the audit log", async () => {
    const address = email("audit");
    cleanUp(address);
    const b = browser();
    await b.send("/support");
    await b.send("/support", {
      form: {
        email: address,
        topic: "other",
        message: `Synthetic audit probe ${TAG}`,
        "cf-turnstile-response": DUMMY_TOKEN,
      },
    });
    expect(
      sqlRows(
        `select count(*) from public.audit_log where target_table in ('consents','enquiries','demand_requests','support_cases') and (details::text like '%${TAG}%' or details::text like '%@%')`,
      ),
    ).toEqual(["0"]);
  });
});
