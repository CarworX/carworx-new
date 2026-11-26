import { describe, expect, it } from "vitest";

import {
  declineReason,
  DECLINE_REASONS,
  hoursWaiting,
  queueRows,
} from "./identity-queue";

const ID = "de3c1000-0000-4000-8000-000000000001";
const row = {
  id: ID,
  user_id: "de3c1000-0000-4000-8000-000000000002",
  status: "in_review",
  id_last4: "1234",
  attempt: 1,
  created_at: "2026-11-25T10:00:00Z",
};

describe("queueRows", () => {
  it("keeps only well-formed rows", () => {
    expect(queueRows({ data: [row, { id: "x" }], error: null })).toEqual([row]);
  });

  it("returns null on an error or a non-list reply", () => {
    expect(queueRows({ data: null, error: { code: "42501" } })).toBeNull();
    expect(queueRows({ data: { row }, error: null })).toBeNull();
  });
});

describe("hoursWaiting", () => {
  it("counts whole hours, never negative", () => {
    const now = Date.parse("2026-11-25T13:30:00Z");
    expect(hoursWaiting("2026-11-25T10:00:00Z", now)).toBe(3);
    expect(hoursWaiting("2026-11-25T14:00:00Z", now)).toBe(0);
  });
});

describe("declineReason", () => {
  it("records a listed reason as it is", () => {
    expect(declineReason(DECLINE_REASONS[0], null)).toBe(DECLINE_REASONS[0]);
  });

  it("needs the person's own words for Other, three characters or more", () => {
    expect(declineReason("Other (write a note)", "  ID photo cut off  ")).toBe(
      "ID photo cut off",
    );
    expect(declineReason("Other (write a note)", "no")).toBeNull();
    expect(declineReason("Other (write a note)", null)).toBeNull();
  });

  it("refuses a reason that is not on the list", () => {
    expect(declineReason("Because I said so", null)).toBeNull();
  });
});
