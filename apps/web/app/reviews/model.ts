/**
 * Review types and the pure helpers the profile and the client share: sort,
 * star counts and the average. No server code here, so the browser can import it.
 */

export interface Review {
  id: string;
  listing_public_id: string;
  author_display: string;
  rating: number;
  body: string;
  service_slug: string | null;
  created_at: string;
  edited_at: string | null;
  reply: ReviewReply | null;
}

export interface ReviewReply {
  body: string;
  created_at: string;
  edited_at: string | null;
}

/** Review sort for the profile: the page's own sort keys, nothing else. */
export const REVIEW_SORTS = ["recent", "highest", "lowest", "replied"] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export function parseReviewSort(value: string | null): ReviewSort {
  return (REVIEW_SORTS as readonly string[]).includes(value ?? "")
    ? (value as ReviewSort)
    : "recent";
}

export function sortReviews(
  reviews: readonly Review[],
  sort: ReviewSort,
): Review[] {
  const copy = [...reviews];
  if (sort === "highest") return copy.sort((a, b) => b.rating - a.rating);
  if (sort === "lowest") return copy.sort((a, b) => a.rating - b.rating);
  if (sort === "replied")
    return copy.sort(
      (a, b) => Number(b.reply !== null) - Number(a.reply !== null),
    );
  return copy;
}

/** Counts per star, 5 down to 1, and the average to one decimal. */
export function ratingBreakdown(reviews: readonly Pick<Review, "rating">[]) {
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
  }));
  const total = reviews.length;
  const average =
    total === 0
      ? null
      : Math.round(
          (reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10,
        ) / 10;
  return { counts, total, average, showBars: total >= 3 };
}
