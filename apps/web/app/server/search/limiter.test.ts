import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GEOCODE_DAILY,
  MAP_DAILY,
  IP_WINDOW,
  SESSION_WINDOW,
  FORM_WINDOW,
  SearchLimiter,
  checkFormLimit,
  checkSearchLimits,
  decide,
  type Counter,
  type LimiterNamespace,
  type LimiterStorage,
  type Window,
} from "./limiter";

const SALT = "synthetic-limiter-salt-".repeat(2);

/** In-memory stand-in for one Durable Object's transactional storage and alarm (tests only). */
type MemoryStorage = LimiterStorage & {
  data: Map<string, unknown>;
  alarm: number | null;
};
function memoryStorage(): MemoryStorage {
  const data = new Map<string, unknown>();
  const storage: MemoryStorage = {
    data,
    alarm: null,
    get: <T>(key: string) => Promise.resolve(data.get(key) as T | undefined),
    put: (key: string, value: unknown) => {
      data.set(key, value);
      return Promise.resolve();
    },
    transaction: <T>(fn: (txn: LimiterStorage) => Promise<T>) => fn(storage),
    getAlarm: () => Promise.resolve(storage.alarm),
    setAlarm: (time: number) => {
      storage.alarm = time;
      return Promise.resolve();
    },
    deleteAlarm: () => {
      storage.alarm = null;
      return Promise.resolve();
    },
    deleteAll: () => {
      data.clear();
      return Promise.resolve();
    },
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

describe("counter retention (R-1)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function check(object: SearchLimiter, window: Window) {
    return object.fetch(
      new Request("https://search-limiter.invalid/check", {
        method: "POST",
        body: JSON.stringify(window),
      }),
    );
  }

  /** Fire the alarm the way workerd does: at (or after) its scheduled time. */
  async function fireAlarm(
    object: SearchLimiter,
    storage: MemoryStorage,
    lateMs = 0,
  ) {
    expect(storage.alarm).not.toBeNull();
    vi.setSystemTime((storage.alarm ?? 0) + lateMs);
    storage.alarm = null;
    await object.alarm();
  }

  it.each([
    ["ip", IP_WINDOW],
    ["session", SESSION_WINDOW],
    ["form", FORM_WINDOW],
    ["geocode quota", GEOCODE_DAILY],
    ["map quota", MAP_DAILY],
  ])(
    "%s: the row is deleted when its window ends, never later",
    async (_, window) => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(1_800_000_000_000);
      const storage = memoryStorage();
      const object = new SearchLimiter({ storage });
      await (await check(object, window)).body?.cancel();
      expect(storage.data.size).toBe(1);
      expect(storage.alarm).toBe(1_800_000_000_000 + window.windowMs);
      // More requests in the same window keep the same deadline.
      vi.setSystemTime(1_800_000_000_000 + window.windowMs - 1);
      await (await check(object, window)).body?.cancel();
      expect(storage.alarm).toBe(1_800_000_000_000 + window.windowMs);
      await fireAlarm(object, storage);
      expect(storage.data.size).toBe(0);
      expect(storage.alarm).toBeNull();
    },
  );

  it("an early alarm keeps the row and re-arms for the window end", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10_000);
    const storage = memoryStorage();
    const object = new SearchLimiter({ storage });
    await (await check(object, IP_WINDOW)).body?.cancel();
    vi.setSystemTime(10_000 + IP_WINDOW.windowMs - 5);
    await object.alarm();
    expect(storage.data.size).toBe(1);
    expect(storage.alarm).toBe(10_000 + IP_WINDOW.windowMs);
  });

  it("a stale row is ignored on access and the alarm moves to the new window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(10_000);
    const storage = memoryStorage();
    const object = new SearchLimiter({ storage });
    for (let i = 0; i <= FORM_WINDOW.limit; i++)
      await (await check(object, FORM_WINDOW)).body?.cancel();
    // The alarm is late; the window has ended, so the next post is fresh.
    const later = 10_000 + FORM_WINDOW.windowMs + 1;
    vi.setSystemTime(later);
    const reply = await check(object, FORM_WINDOW);
    expect(await reply.json()).toEqual({ allowed: true });
    expect(storage.data.get("window")).toEqual({
      start: later,
      count: 1,
      windowMs: FORM_WINDOW.windowMs,
    });
    expect(storage.alarm).toBe(later + FORM_WINDOW.windowMs);
    await fireAlarm(object, storage, 250);
    expect(storage.data.size).toBe(0);
  });

  it("an alarm on a legacy or damaged row deletes it", async () => {
    for (const row of [
      { start: 1, count: 3 },
      { start: "x", count: 1, windowMs: 60_000 },
      undefined,
    ]) {
      const storage = memoryStorage();
      if (row) storage.data.set("window", row);
      storage.alarm = 1;
      await new SearchLimiter({ storage }).alarm();
      expect(storage.data.size).toBe(0);
      expect(storage.alarm).toBeNull();
    }
  });

  it("a failed alarm write fails the request, and the next one re-arms (Codex P2 on #88)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(70_000);
    const storage = memoryStorage();
    let fail = true;
    storage.setAlarm = (time: number) => {
      if (fail) {
        fail = false;
        return Promise.reject(new Error("synthetic alarm outage"));
      }
      storage.alarm = time;
      return Promise.resolve();
    };
    // A real transaction rolls back the row; this stub keeps it, which is
    // the worse case: a row with no alarm.
    const object = new SearchLimiter({ storage });
    const first = await check(object, IP_WINDOW);
    expect(first.status).toBe(500);
    await first.body?.cancel();
    expect(storage.alarm).toBeNull();
    vi.setSystemTime(70_000 + 1_000);
    const second = await check(object, IP_WINDOW);
    expect(await second.json()).toEqual({ allowed: true });
    expect(storage.alarm).toBe(70_000 + IP_WINDOW.windowMs);
  });

  it("a refused (over-limit) request never extends the row's life", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(50_000);
    const storage = memoryStorage();
    const object = new SearchLimiter({ storage });
    for (let i = 0; i < IP_WINDOW.limit + 10; i++) {
      vi.setSystemTime(50_000 + i * 100);
      await (await check(object, IP_WINDOW)).body?.cancel();
    }
    expect(storage.alarm).toBe(50_000 + IP_WINDOW.windowMs);
  });
});
