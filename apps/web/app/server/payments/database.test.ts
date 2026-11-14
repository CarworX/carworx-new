import { beforeEach, describe, expect, it, vi } from "vitest";
import { moneyDatabase } from "./database.server";

const client = vi.hoisted(() => ({
  connect: vi.fn(),
  end: vi.fn(),
  query: vi.fn(),
}));
vi.mock("pg", () => ({
  Client: class {
    connect = client.connect;
    end = client.end;
    query = client.query;
  },
}));
const payment = {
  reference: "cx_" + "a".repeat(32),
  providerId: "123",
  amountMinor: 12500,
  currency: "ZAR",
};
beforeEach(() => {
  vi.resetAllMocks();
  client.connect.mockResolvedValue(undefined);
  client.end.mockResolvedValue(undefined);
});
const statements = () => client.query.mock.calls.map(([sql]) => String(sql));

describe("A24/A26 atomic payment effects (transaction boundary)", () => {
  it("rolls back booking confirmation when finishing the money effect fails", async () => {
    client.query.mockImplementation((sql: string) => {
      if (sql.includes("stage_verified_charge"))
        return Promise.resolve({
          rows: [
            {
              value: {
                duplicate: false,
                hold_id: "hold",
                attempt_id: "attempt",
              },
            },
          ],
        });
      if (sql.includes("confirm_paid"))
        return Promise.resolve({ rows: [{ outcome: "confirmed" }] });
      if (sql.includes("finish_charge_effect"))
        throw new Error("synthetic interrupted write");
      return Promise.resolve({ rows: [] });
    });
    await expect(
      moneyDatabase("synthetic").applyCharge("key", payment),
    ).rejects.toThrow("payment_database_unavailable");
    expect(statements()).toEqual([
      "begin",
      "select private.stage_verified_charge($1,$2,$3,$4,$5) as value",
      "select private.confirm_paid($1,$2) as outcome",
      "select private.finish_charge_effect($1,$2,$3,$4)",
      "rollback",
    ]);
    expect(client.end).toHaveBeenCalledOnce();
  });
  it("acknowledges replay without confirming the booking again", async () => {
    client.query.mockImplementation((sql: string) =>
      Promise.resolve({
        rows: sql.includes("stage_verified_charge")
          ? [{ value: { duplicate: true } }]
          : [],
      }),
    );
    await moneyDatabase("synthetic").applyCharge("key", payment);
    expect(statements().some((s) => s.includes("ack_duplicate_payment"))).toBe(
      true,
    );
    expect(statements().some((s) => s.includes("confirm_paid"))).toBe(false);
    expect(statements().at(-1)).toBe("commit");
  });
  it.each(["confirmed", "hold_expired"])(
    "commits %s booking and payment effects together",
    async (outcome) => {
      client.query.mockImplementation((sql: string) =>
        Promise.resolve({
          rows: sql.includes("stage_verified_charge")
            ? [
                {
                  value: {
                    duplicate: false,
                    hold_id: "hold",
                    attempt_id: "attempt",
                  },
                },
              ]
            : sql.includes("confirm_paid")
              ? [{ outcome }]
              : [],
        }),
      );
      await moneyDatabase("synthetic").applyCharge("key", payment);
      expect(client.query).toHaveBeenCalledWith(
        "select private.finish_charge_effect($1,$2,$3,$4)",
        ["key", "attempt", "123", outcome],
      );
      expect(statements().at(-1)).toBe("commit");
    },
  );
});
