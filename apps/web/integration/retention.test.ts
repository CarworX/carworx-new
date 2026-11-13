import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { sql, sqlRows, stack } from "./harness";

/**
 * R-2: the built Worker's daily cron, run as the real scoped retention_server
 * login against the local stack. SYNTHETIC rows only, removed afterwards.
 */
interface Scheduled {
  scheduled(controller: unknown, env: unknown, ctx: unknown): Promise<void>;
}
const password = `synthetic-${randomUUID()}`;
const TAG = randomUUID().slice(0, 8);
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };

function login(user = "retention_server", pass = password): string {
  const url = new URL(stack.dbUrl);
  url.username = user;
  url.password = pass;
  return url.toString();
}

async function worker(): Promise<Scheduled> {
  const module = (await import(
    pathToFileURL(
      join(import.meta.dirname, "..", "build", "server", "index.js"),
    ).href
  )) as { default: Scheduled };
  return module.default;
}

beforeAll(() => {
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sql(
    `alter role retention_server password '${password}' valid until '${until}'`,
  );
});
afterAll(() => {
  sql("alter role retention_server password null");
  sql(
    `delete from public.support_cases where email like 'r2-%-${TAG}@example.test'`,
  );
});

describe("R-2 retention cron (built Worker)", () => {
  it("deletes an expired row as retention_server and logs counts only", async () => {
    sql(`insert into public.support_cases(email, topic, message, status, closed_at, close_note, created_at) values
      ('r2-old-${TAG}@example.test','other','Synthetic old closed case','closed', now() - interval '37 months','Synthetic note', now() - interval '38 months'),
      ('r2-new-${TAG}@example.test','other','Synthetic recent closed case','closed', now() - interval '1 month','Synthetic note', now() - interval '2 months')`);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await (
        await worker()
      ).scheduled(
        { cron: "17 1 * * *", scheduledTime: Date.now() },
        { RETENTION_DB: { connectionString: login() } },
        ctx,
      );
      expect(log).toHaveBeenCalledTimes(1);
      const line = String(log.mock.calls[0]?.[0]);
      const parsed = JSON.parse(line) as {
        event: string;
        counts: Record<string, number>;
      };
      expect(parsed.event).toBe("retention");
      expect(Object.keys(parsed.counts).sort()).toEqual([
        "consents",
        "demand_requests",
        "enquiries",
        "listing_claims",
        "support_cases",
        "verifications",
      ]);
      expect(parsed.counts["support_cases"]).toBeGreaterThanOrEqual(1);
      expect(line).not.toMatch(/example\.test|Synthetic|postgres:/);
    } finally {
      log.mockRestore();
    }
    expect(
      sqlRows(
        `select email from public.support_cases where email like 'r2-%-${TAG}@example.test'`,
      ),
    ).toEqual([`r2-new-${TAG}@example.test`]);
  });

  it("fails the cron run without the binding or with the wrong login", async () => {
    const w = await worker();
    await expect(w.scheduled({}, {}, ctx)).rejects.toThrow(
      "retention run failed: binding_missing",
    );
    await expect(
      w.scheduled(
        {},
        {
          RETENTION_DB: {
            connectionString: login("retention_server", "wrong"),
          },
        },
        ctx,
      ),
    ).rejects.toThrow("retention run failed: query_failed");
  });
});
