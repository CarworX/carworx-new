import { describe, expect, it } from "vitest";

import {
  IP_WINDOW,
  SESSION_WINDOW,
  FORM_WINDOW,
  SearchLimiter,
  checkFormLimit,
  checkSearchLimits,
  decide,
  type Counter,
  type LimiterNamespace,
} from "./limiter";

const SALT = "synthetic-limiter-salt-".repeat(2);

/** In-memory stand-in for one Durable Object's transactional storage (tests only). */
interface MemoryStorage {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  transaction<T>(fn: (txn: MemoryStorage) => Promise<T>): Promise<T>;
}
function memoryStorage(): MemoryStorage {
  const data = new Map<string, unknown>();
  const storage: MemoryStorage = {
    get: <T>(key: string) => Promise.resolve(data.get(key) as T | undefined),
    put: (key: string, value: unknown) => {
      data.set(key, value);
      return Promise.resolve();
    },
    transaction: <T>(fn: (txn: MemoryStorage) => Promise<T>) => fn(storage),
  };
  return storage;
}

/** A namespace of real SearchLimiter instances, one per name, as workerd would route. */
function namespace(): LimiterNamespace & { names: string[] } {
  const objects = new Map<string, SearchLimiter>();
  const names: string[] = [];
  return {
    names,
    idFromName: (name: string) => name,
    get: (id: unknown) => {
      const name = id as string;
      if (!objects.has(name)) {
        names.push(name);
        objects.set(name, new SearchLimiter({ storage: memoryStorage() }));
      }
      const object = objects.get(name);
      return {
        fetch: (url: string, init: RequestInit) =>
          object
            ? object.fetch(new Request(url, init))
            : Promise.reject(new Error("missing")),
      };
    },
  };
}

describe("fixed-window decision", () => {
  it("allows up to the limit, then reports a retry time", () => {
    let c: Counter | undefined;
    for (let i = 0; i < IP_WINDOW.limit; i++) {
      const d = decide(c, 1_000, IP_WINDOW);
      expect(d.allowed).toBe(true);
      c = d.next;
    }
    const over = decide(c, 1_000 + 30_500, IP_WINDOW);
    expect(over).toMatchObject({ allowed: false, retryAfterSeconds: 30 });
    expect(
      decide(over.next, 1_000 + IP_WINDOW.windowMs, IP_WINDOW).allowed,
    ).toBe(true);
  });
});

describe("search limits", () => {
  it("applies independent IP and session windows with hashed keys", async () => {
    const ns = namespace();
    for (let i = 0; i < IP_WINDOW.limit; i++)
      expect(
        (await checkSearchLimits(ns, SALT, "198.51.100.7", `s${String(i)}`))
          .kind,
      ).toBe("allowed");
    expect(
      await checkSearchLimits(ns, SALT, "198.51.100.7", "fresh"),
    ).toMatchObject({ kind: "limited" });
    // Another IP with a session that has used the IP bucket elsewhere is still allowed.
    expect((await checkSearchLimits(ns, SALT, "203.0.113.9", "s1")).kind).toBe(
      "allowed",
    );
    for (const name of ns.names) {
      expect(name).not.toMatch(/198\.51|203\.0|fresh|s1\b/);
      expect(name).toMatch(/^(?:ip|session):[0-9a-f]{64}$/);
    }
  });

  it("limits one session across many IPs", async () => {
    const ns = namespace();
    for (let i = 0; i < SESSION_WINDOW.limit; i++)
      expect(
        (
          await checkSearchLimits(
            ns,
            SALT,
            `192.0.2.${String(i)}`,
            "one-session",
          )
        ).kind,
      ).toBe("allowed");
    expect(
      (await checkSearchLimits(ns, SALT, "192.0.2.250", "one-session")).kind,
    ).toBe("limited");
  });

  it("fails closed when the binding, salt or object is unavailable", async () => {
    expect((await checkSearchLimits(undefined, SALT, "ip", "s")).kind).toBe(
      "unavailable",
    );
    expect(
      (await checkSearchLimits(namespace(), "short", "ip", "s")).kind,
    ).toBe("unavailable");
    const broken: LimiterNamespace = {
      idFromName: () => "x",
      get: () => ({ fetch: () => Promise.reject(new Error("outage")) }),
    };
    expect((await checkSearchLimits(broken, SALT, "ip", "s")).kind).toBe(
      "unavailable",
    );
    const erroring: LimiterNamespace = {
      idFromName: () => "x",
      get: () => ({
        fetch: () => Promise.resolve(Response.json({}, { status: 500 })),
      }),
    };
    expect((await checkSearchLimits(erroring, SALT, "ip", "s")).kind).toBe(
      "unavailable",
    );
  });

  it("rejects unknown windows inside the object", async () => {
    const object = new SearchLimiter({ storage: memoryStorage() });
    const response = await object.fetch(
      new Request("https://x.invalid", {
        method: "POST",
        body: JSON.stringify({ limit: 1_000_000, windowMs: 1 }),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("form limits (P2-5)", () => {
  it("allows 5 posts per IP per form, with hashed keys apart from search", async () => {
    const ns = namespace();
    for (let i = 0; i < FORM_WINDOW.limit; i++)
      expect(
        (await checkFormLimit(ns, SALT, "198.51.100.7", "enquiry")).kind,
      ).toBe("allowed");
    expect(
      await checkFormLimit(ns, SALT, "198.51.100.7", "enquiry"),
    ).toMatchObject({ kind: "limited" });
    // Another form, another IP and search keep their own counters.
    expect(
      (await checkFormLimit(ns, SALT, "198.51.100.7", "support")).kind,
    ).toBe("allowed");
    expect(
      (await checkFormLimit(ns, SALT, "203.0.113.9", "enquiry")).kind,
    ).toBe("allowed");
    expect((await checkSearchLimits(ns, SALT, "198.51.100.7", "s1")).kind).toBe(
      "allowed",
    );
    const forms = ns.names.filter((n) => n.startsWith("form:"));
    expect(forms).toHaveLength(3);
    for (const name of forms)
      expect(name).toMatch(/^form:(?:enquiry|support):ip:[0-9a-f]{64}$/);
    expect(ns.names.join(" ")).not.toMatch(/198\.51|203\.0/);
  });

  it("fails closed without a binding or a long enough salt", async () => {
    expect(
      await checkFormLimit(undefined, SALT, "198.51.100.7", "demand"),
    ).toEqual({ kind: "unavailable" });
    expect(
      await checkFormLimit(namespace(), "short", "198.51.100.7", "demand"),
    ).toEqual({ kind: "unavailable" });
  });
});
