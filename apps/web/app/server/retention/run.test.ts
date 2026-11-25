import { describe, expect, it } from "vitest";

import {
  JOBS,
  RETENTION_SQL,
  RetentionError,
  parseCounts,
  purgeAccounts,
  purgeMedia,
  runRetention,
  type RetentionClient,
} from "./run";

const ROWS = JOBS.map((job, i) => ({ job, deleted: i }));

function fake(answer: () => Promise<{ rows: unknown[] }>) {
  const calls: string[] = [];
  let ended = 0;
  const client: RetentionClient = {
    connect: () => Promise.resolve(),
    query: (sql: string) => {
      calls.push(sql);
      return answer();
    },
    end: () => {
      ended++;
      return Promise.resolve();
    },
  };
  return { calls, ended: () => ended, make: () => Promise.resolve(client) };
}

describe("R-2 retention runner", () => {
  it("runs the one fixed statement and returns the counts", async () => {
    const f = fake(() => Promise.resolve({ rows: ROWS }));
    const counts = await runRetention(
      { connectionString: "postgres://synthetic" },
      f.make,
    );
    expect(f.calls).toEqual([RETENTION_SQL]);
    expect(f.ended()).toBe(1);
    expect(counts).toEqual({
      demand_requests: 0,
      enquiries: 1,
      support_cases: 2,
      consents: 3,
      listing_claims: 4,
      verifications: 5,
    });
  });

  it("fails without a binding and never connects", async () => {
    const f = fake(() => Promise.resolve({ rows: ROWS }));
    for (const binding of [undefined, {}, { connectionString: "" }])
      await expect(runRetention(binding, f.make)).rejects.toThrow(
        "retention run failed: binding_missing",
      );
    expect(f.calls).toEqual([]);
  });

  it("hides the database error and still closes the connection", async () => {
    const f = fake(() =>
      Promise.reject(new Error("synthetic secret detail from postgres")),
    );
    const error = await runRetention(
      { connectionString: "postgres://synthetic" },
      f.make,
    ).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RetentionError);
    expect(String(error)).toBe(
      "RetentionError: retention run failed: query_failed",
    );
    expect(f.ended()).toBe(1);
  });

  it.each([
    ["a missing job", ROWS.slice(1)],
    ["a repeated job", [...ROWS, ROWS[0]]],
    ["an unknown job", [...ROWS.slice(1), { job: "profiles", deleted: 0 }]],
    ["a negative count", [{ job: "enquiries", deleted: -1 }, ...ROWS.slice(1)]],
    [
      "a text count",
      [{ job: "demand_requests", deleted: "1" }, ...ROWS.slice(1)],
    ],
    ["extra row data", [...ROWS, { email: "x@example.test" }]],
  ])("rejects a result with %s", (_, rows) => {
    expect(() => parseCounts(rows)).toThrow(RetentionError);
  });
});

describe("cover photo file clean-up (D-098)", () => {
  const binding = { connectionString: "postgres://synthetic" };
  const KEY = (c: string) => `covers/${c.repeat(32)}.jpg`;
  function media() {
    const deleted: string[][] = [];
    return {
      deleted,
      bucket: {
        delete: (keys: string[]) => {
          deleted.push(keys);
          return Promise.resolve();
        },
      },
    };
  }

  it("claims keys, deletes them from R2, then confirms", async () => {
    const m = media();
    const answers = [
      { rows: [{ k: KEY("a") }, { k: KEY("b") }] },
      { rows: [{ n: 2 }] },
    ];
    const f = fake(() => Promise.resolve(answers.shift() ?? { rows: [] }));
    expect(await purgeMedia(binding, f.make, m.bucket)).toEqual({
      deleted: 2,
    });
    expect(m.deleted).toEqual([[KEY("a"), KEY("b")]]);
    expect(f.calls).toHaveLength(2);
    expect(f.ended()).toBe(1);
  });

  it("also deletes expired or downloaded data exports (D-098)", async () => {
    const m = media();
    const exportKey = `exports/${"e".repeat(32)}.json`;
    const answers = [{ rows: [{ k: exportKey }] }, { rows: [{ n: 1 }] }];
    const f = fake(() => Promise.resolve(answers.shift() ?? { rows: [] }));
    expect(await purgeMedia(binding, f.make, m.bucket)).toEqual({
      deleted: 1,
    });
    expect(m.deleted).toEqual([[exportKey]]);
  });

  it("does nothing when the queue is empty", async () => {
    const m = media();
    const f = fake(() => Promise.resolve({ rows: [] }));
    expect(await purgeMedia(binding, f.make, m.bucket)).toEqual({
      deleted: 0,
    });
    expect(m.deleted).toEqual([]);
  });

  it("refuses any key that is not a cover key, and deletes nothing", async () => {
    const m = media();
    const f = fake(() => Promise.resolve({ rows: [{ k: "../secrets.txt" }] }));
    await expect(purgeMedia(binding, f.make, m.bucket)).rejects.toThrow(
      RetentionError,
    );
    expect(m.deleted).toEqual([]);
    expect(f.ended()).toBe(1);
  });

  it("fails without the bucket or the database binding", async () => {
    const f = fake(() => Promise.resolve({ rows: [] }));
    await expect(purgeMedia(binding, f.make, null)).rejects.toThrow(
      "binding_missing",
    );
    await expect(purgeMedia(undefined, f.make, media().bucket)).rejects.toThrow(
      "binding_missing",
    );
  });
});

describe("closed accounts after 14 days (D-098)", () => {
  const binding = { connectionString: "postgres://synthetic" };
  const NOW = Date.parse("2026-12-10T01:17:00Z");
  const user = "d5700000-0000-4000-8000-000000000001";
  const due = (daysLate: number) => ({
    user_id: user,
    email: "sam.staff@example.test",
    delete_after: new Date(NOW - daysLate * 86_400_000),
  });
  function run(daysLate: number) {
    const answers = [{ rows: [due(daysLate)] }, { rows: [{ done: true }] }];
    return fake(() => Promise.resolve(answers.shift() ?? { rows: [] }));
  }

  it("queues the final email, then deletes the account", async () => {
    const f = run(0);
    const sent: string[] = [];
    const counts = await purgeAccounts(
      binding,
      f.make,
      (id, email) => {
        sent.push(`${id}:${email}`);
        return Promise.resolve("queued");
      },
      () => NOW,
    );
    expect(counts).toEqual({ deleted: 1, emailed: 1, postponed: 0 });
    expect(sent).toEqual([`${user}:sam.staff@example.test`]);
    expect(f.calls).toHaveLength(2);
  });

  it("waits for the next run when mail is down, but not past 7 days", async () => {
    const early = run(1);
    expect(
      await purgeAccounts(
        binding,
        early.make,
        () => Promise.resolve("unavailable"),
        () => NOW,
      ),
    ).toEqual({ deleted: 0, emailed: 0, postponed: 1 });
    expect(early.calls).toHaveLength(1);

    const late = run(8);
    expect(
      await purgeAccounts(
        binding,
        late.make,
        () => Promise.resolve("unavailable"),
        () => NOW,
      ),
    ).toEqual({ deleted: 1, emailed: 0, postponed: 0 });
  });

  it("deletes without an email when mail is not set up", async () => {
    const f = run(0);
    expect(await purgeAccounts(binding, f.make, null, () => NOW)).toEqual({
      deleted: 1,
      emailed: 0,
      postponed: 0,
    });
  });

  it("refuses a malformed row and never deletes", async () => {
    const f = fake(() =>
      Promise.resolve({ rows: [{ user_id: "x; drop", email: "a@b.test" }] }),
    );
    await expect(purgeAccounts(binding, f.make, null)).rejects.toThrow(
      RetentionError,
    );
    expect(f.calls).toHaveLength(1);
    expect(f.ended()).toBe(1);
  });
});
