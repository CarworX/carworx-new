import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseReviewSort,
  ratingBreakdown,
  reviewFailureText,
  reviewOutcomeOf,
  saveReview,
  sortReviews,
  type Review,
} from "./reviews.server";

function review(id: string, rating: number, replied = false): Review {
  return {
    id,
    listing_public_id: "ca7c1000-0000-4000-8000-000000000001",
    author_display: "Synthetic R.",
    rating,
    body: "Synthetic review text, long enough.",
    service_slug: null,
    created_at: "2026-11-20T10:00:00Z",
    edited_at: null,
    reply: replied
      ? {
          body: "Thanks, synthetic reply.",
          created_at: "2026-11-21T10:00:00Z",
          edited_at: null,
        }
      : null,
  };
}

describe("review errors", () => {
  it("maps the K5 Postgres codes to plain outcomes", () => {
    expect(reviewOutcomeOf({ code: "42501" })).toEqual({
      ok: false,
      reason: "not_allowed",
    });
    expect(reviewOutcomeOf({ code: "22023" })).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(reviewOutcomeOf({ code: "08006" })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(reviewOutcomeOf(null)).toEqual({ ok: false, reason: "unavailable" });
  });

  it("says why, in plain words, for each failure", () => {
    expect(reviewFailureText("not_allowed")).toBe(
      "Only customers who contacted this business can review it.",
    );
    expect(reviewFailureText("invalid")).toBe(
      "Check the highlighted fields and try again.",
    );
    expect(reviewFailureText("unavailable")).toContain("Try again");
  });

  it("returns the not_allowed outcome from saveReview when the RPC refuses", async () => {
    const client = {
      rpc: () =>
        Promise.resolve({
          data: null,
          error: { code: "42501", message: "not_allowed" },
        }),
    } as unknown as SupabaseClient;
    const result = await saveReview(client, {
      listing: "ca7c1000-0000-4000-8000-000000000001",
      rating: 4,
      body: "Synthetic review text, long enough.",
      service: null,
    });
    expect(result).toEqual({ ok: false, reason: "not_allowed" });
  });
});

describe("review sort", () => {
  it("accepts only the four sort keys and defaults to recent", () => {
    expect(parseReviewSort("highest")).toBe("highest");
    expect(parseReviewSort("replied")).toBe("replied");
    expect(parseReviewSort("drop table")).toBe("recent");
    expect(parseReviewSort(null)).toBe("recent");
  });

  it("orders by rating, or puts replied reviews first", () => {
    const rows = [review("a", 3), review("b", 5, true), review("c", 1)];
    expect(sortReviews(rows, "highest").map((r) => r.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(sortReviews(rows, "lowest").map((r) => r.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(sortReviews(rows, "replied").map((r) => r.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });
});

describe("rating breakdown", () => {
  it("counts each star and hides bars under three reviews", () => {
    const two = ratingBreakdown([review("a", 5), review("b", 4)]);
    expect(two.total).toBe(2);
    expect(two.average).toBe(4.5);
    expect(two.showBars).toBe(false);

    const three = ratingBreakdown([
      review("a", 5),
      review("b", 5),
      review("c", 2),
    ]);
    expect(three.showBars).toBe(true);
    expect(three.counts.find((c) => c.stars === 5)?.count).toBe(2);
    expect(three.counts.find((c) => c.stars === 1)?.count).toBe(0);
  });

  it("has no average with no reviews", () => {
    expect(ratingBreakdown([])).toMatchObject({
      total: 0,
      average: null,
      showBars: false,
    });
  });
});
