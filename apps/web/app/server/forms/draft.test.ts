import { describe, expect, it } from "vitest";

import { DRAFT_COOKIE, forgetDraft, keepDraft, readDraft } from "./draft";

const ID = "de3c1000-0000-4000-8000-000000000001";
const OTHER = "de3c1000-0000-4000-8000-000000000002";

function back(setCookie: string): Request {
  const pair = setCookie.split(";")[0] ?? "";
  return new Request("http://localhost/p/x", { headers: { Cookie: pair } });
}

describe("draft kept through sign-in without JavaScript", () => {
  it("round-trips a message for its own listing only", () => {
    const set = keepDraft(ID, "Hi, any space on Saturday? Ünïcode ok.") ?? "";
    expect(set).toMatch(new RegExp(`^${DRAFT_COOKIE}=`));
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/Max-Age=3600/i);
    expect(readDraft(back(set), ID)).toBe(
      "Hi, any space on Saturday? Ünïcode ok.",
    );
    expect(readDraft(back(set), OTHER)).toBe("");
  });

  it("keeps nothing for an empty message or a bad listing id", () => {
    expect(keepDraft(ID, "   ")).toBeNull();
    expect(keepDraft("not-a-uuid", "Hello there")).toBeNull();
  });

  it("caps the message and skips one too big for a cookie", () => {
    const long = keepDraft(ID, "x".repeat(5000)) ?? "";
    expect(readDraft(back(long), ID)).toHaveLength(1000);
    expect(keepDraft(ID, "€".repeat(1000))).toBeNull();
  });

  it("ignores a tampered or garbage cookie and can be forgotten", () => {
    const bad = new Request("http://localhost/", {
      headers: { Cookie: `${DRAFT_COOKIE}=%%%` },
    });
    expect(readDraft(bad, ID)).toBe("");
    expect(forgetDraft()).toMatch(/Max-Age=0/i);
  });
});
