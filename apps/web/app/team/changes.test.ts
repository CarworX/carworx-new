import { describe, expect, it } from "vitest";
import { readTeamChanges } from "./changes";

const event = {
  id: 1,
  occurred_at: "2026-11-12T08:00:00Z",
  action: "update",
  target_table: "memberships",
};

describe("team history response boundary", () => {
  it("hydrates only the allowed audit projection", () => {
    expect(
      readTeamChanges([
        {
          ...event,
          actor_id: "private",
          details: { email: "private@example.test" },
        },
      ]),
    ).toEqual([event]);
    expect(readTeamChanges([])).toEqual([]);
  });
  it("rejects single-object, oversized and malformed responses", () => {
    expect(readTeamChanges(event)).toBeNull();
    expect(readTeamChanges(null)).toBeNull();
    expect(
      readTeamChanges(Array.from({ length: 101 }, () => event)),
    ).toBeNull();
    for (const patch of [
      { id: Number.MAX_SAFE_INTEGER + 1 },
      { occurred_at: "invalid" },
      { action: "transfer" },
      { target_table: "payments" },
    ]) {
      expect(readTeamChanges([{ ...event, ...patch }])).toBeNull();
    }
  });
});
