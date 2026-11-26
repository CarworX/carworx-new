import { describe, expect, it } from "vitest";

import { ratingStars, reviewRatingText } from "./ListingResult";

describe("rating stars", () => {
  it("rounds the average to whole stars", () => {
    expect(ratingStars(4.8)).toBe("★★★★★");
    expect(ratingStars(3.2)).toBe("★★★☆☆");
    expect(ratingStars(0)).toBe("☆☆☆☆☆");
  });

  it("keeps the text that goes with the stars", () => {
    expect(reviewRatingText({ rating_avg: 4.8, rating_count: 126 })).toBe(
      "4.8 out of 5 · 126 reviews",
    );
    expect(reviewRatingText({ rating_avg: null, rating_count: 0 })).toBe("New");
  });
});
