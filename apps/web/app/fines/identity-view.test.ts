import { describe, expect, it } from "vitest";

import {
  identityView,
  parseIdentityRow,
  reasonCopy,
  type IdentityRow,
} from "./identity-view";

const row = (extra: Partial<IdentityRow>): IdentityRow => ({
  state: "none",
  reason: null,
  attempt: 0,
  tries_left: 3,
  decided_at: null,
  ...extra,
});

describe("identityView", () => {
  it("shows the intro with no check yet, or when the status could not be read", () => {
    expect(identityView(null)).toEqual({ kind: "intro" });
    expect(identityView(row({ state: "none" }))).toEqual({ kind: "intro" });
  });

  it("maps the decided states to their screens", () => {
    expect(identityView(row({ state: "approved" }))).toEqual({
      kind: "approved",
    });
    expect(identityView(row({ state: "checking" }))).toEqual({
      kind: "checking",
    });
    expect(identityView(row({ state: "in_review" }))).toEqual({
      kind: "in_review",
    });
  });

  it("counts tries from tries_left: one used, two left", () => {
    expect(
      identityView(
        row({
          state: "declined",
          reason: "face_mismatch",
          attempt: 1,
          tries_left: 2,
        }),
      ),
    ).toEqual({
      kind: "declined",
      reason: "The selfie didn't match the photo on your ID.",
      used: 1,
      left: 2,
    });
  });

  it("is locked once the last try is declined, and says why", () => {
    expect(
      identityView(
        row({
          state: "declined",
          reason: "document_unreadable",
          tries_left: 0,
        }),
      ),
    ).toEqual({
      kind: "locked",
      reason: "The ID photo was too blurry or dark to read.",
    });
  });

  it("is locked when the server says so", () => {
    expect(identityView(row({ state: "locked", tries_left: 0 }))).toEqual({
      kind: "locked",
      reason: "We couldn't confirm it this time.",
    });
  });

  it("clamps a bad tries_left into 0..3", () => {
    expect(
      identityView(row({ state: "declined", tries_left: 9, reason: null })),
    ).toEqual({
      kind: "declined",
      reason: "We couldn't confirm it this time.",
      used: 0,
      left: 3,
    });
    expect(
      identityView(row({ state: "declined", tries_left: -2 })),
    ).toMatchObject({
      kind: "locked",
    });
  });
});

describe("reasonCopy", () => {
  it("plain words for each Didit reason, and a general line for anything else", () => {
    expect(reasonCopy("liveness_failed")).toBe(
      "The selfie check didn't confirm a live person.",
    );
    expect(reasonCopy("something_new")).toBe(
      "We couldn't confirm it this time.",
    );
    expect(reasonCopy(null)).toBe("We couldn't confirm it this time.");
  });
});

describe("parseIdentityRow", () => {
  it("reads the first row of my_identity_status()", () => {
    expect(
      parseIdentityRow({
        data: [
          {
            state: "checking",
            reason: null,
            attempt: 1,
            tries_left: 2,
            decided_at: null,
          },
        ],
        error: null,
      }),
    ).toMatchObject({ state: "checking", attempt: 1, tries_left: 2 });
  });

  it("returns null on an error, an empty reply or a malformed row", () => {
    expect(parseIdentityRow({ data: null, error: { code: "x" } })).toBeNull();
    expect(parseIdentityRow({ data: [], error: null })).toBeNull();
    expect(
      parseIdentityRow({ data: [{ tries_left: 1 }], error: null }),
    ).toBeNull();
  });
});
