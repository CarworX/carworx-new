/**
 * The reviews section on a business profile (A8, B-23): the summary with its
 * bars, the sort chips, each review with the owner's public reply, and the
 * empty state. Reads come from server/reviews; this file only shows them.
 */
import { Link } from "react-router";

import { CsrfField } from "../auth/ui";
import { REPORT_REASONS } from "../reviews/report";
import {
  ratingBreakdown,
  type Review,
  type ReviewSort,
} from "../reviews/model";

const SORTS: { key: ReviewSort; label: string }[] = [
  { key: "recent", label: "Most recent" },
  { key: "highest", label: "Highest" },
  { key: "lowest", label: "Lowest" },
  { key: "replied", label: "With a reply" },
];

const DATE = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Africa/Johannesburg",
});

export function dateOfReview(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : DATE.format(new Date(time));
}

/** Stars as text for screen readers, with the visible glyphs hidden from them. */
export function Stars({ rating }: { rating: number }) {
  const filled = "★".repeat(rating);
  const empty = "☆".repeat(5 - rating);
  return (
    <span className="stars" aria-label={`${String(rating)} out of 5 stars`}>
      <span aria-hidden="true">
        {filled}
        {empty}
      </span>
    </span>
  );
}

/** The average and count come from the whole listing; bars need every review loaded. */
export function ReviewSummary({
  reviews,
  business,
  aggregate,
}: {
  reviews: readonly Pick<Review, "rating">[];
  business: string;
  aggregate: { average: number | null; count: number };
}) {
  const { counts } = ratingBreakdown(reviews);
  const total = aggregate.count;
  if (total === 0 || aggregate.average === null) return null;
  const showBars = total >= 3 && reviews.length === total;
  return (
    <div className="review-summary">
      <p className="review-average">
        <span className="review-average-number">
          {aggregate.average.toFixed(1)}
        </span>
        <span className="small muted">
          {" "}
          out of 5 · {String(total)} {total === 1 ? "review" : "reviews"} for{" "}
          {business}
        </span>
      </p>
      {showBars ? (
        <ul className="review-bars" aria-label="Ratings by stars">
          {counts.map((row) => (
            <li key={row.stars}>
              <span>{row.stars} stars</span>
              <span className="review-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${String(total === 0 ? 0 : Math.round((row.count / total) * 100))}%`,
                  }}
                />
              </span>
              <span className="small muted">{row.count}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function SortChips({
  current,
  pathname,
}: {
  current: ReviewSort;
  pathname: string;
}) {
  return (
    <nav aria-label="Sort reviews" className="review-sorts">
      {SORTS.map((s) => (
        <Link
          key={s.key}
          to={
            s.key === "recent"
              ? `${pathname}#reviews`
              : `${pathname}?sort=${s.key}#reviews`
          }
          aria-current={current === s.key ? "true" : undefined}
          className={current === s.key ? "chip on" : "chip"}
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

export function ReviewItem({
  review,
  business,
  reportTo,
  csrf,
}: {
  review: Review;
  business: string;
  reportTo: string;
  csrf: string;
}) {
  return (
    <article className="review-item" aria-labelledby={`review-${review.id}`}>
      <header>
        <Stars rating={review.rating} />
        <h3 id={`review-${review.id}`} className="review-author">
          {review.author_display}
        </h3>
        <p className="small muted">
          {dateOfReview(review.created_at)}
          {review.edited_at
            ? ` · Edited ${dateOfReview(review.edited_at)}`
            : ""}
          {review.service_slug
            ? ` · ${review.service_slug.replace(/-/g, " ")}`
            : ""}
        </p>
      </header>
      <p>{review.body}</p>
      {review.reply ? (
        <aside className="review-reply" aria-label={`Reply from ${business}`}>
          <p className="small">
            <strong>Reply from {business}</strong>
            <span className="muted">
              {" "}
              · {dateOfReview(review.reply.created_at)}
            </span>
          </p>
          <p>{review.reply.body}</p>
        </aside>
      ) : null}
      <details className="cx-report">
        <summary>Report this review</summary>
        <form method="post" action={reportTo}>
          <CsrfField token={csrf} />
          <p className="small">
            Our team checks every report. The reviewer isn&apos;t told who
            reported it.
          </p>
          <fieldset>
            <legend>Why?</legend>
            {REPORT_REASONS.map((reason) => (
              <label key={reason} className="report-option">
                <input type="radio" name="reason" value={reason} required />{" "}
                {reason}
              </label>
            ))}
          </fieldset>
          <label>
            Anything else? (optional)
            <textarea name="note" maxLength={500} rows={2} />
          </label>
          <button type="submit">Send report</button>
        </form>
      </details>
    </article>
  );
}

export function ReviewsSection({
  reviews,
  csrf,
  aggregate,
  business,
  sort,
  pathname,
  eligibility,
}: {
  reviews: readonly Review[];
  csrf: string;
  aggregate: { average: number | null; count: number };
  business: string;
  sort: ReviewSort;
  pathname: string;
  eligibility: "write" | "message_first" | "sign_in" | "unavailable";
}) {
  return (
    <section id="reviews" className="card reviews" aria-labelledby="reviews-h">
      <h2 id="reviews-h">Reviews</h2>
      <p className="small muted">
        Only customers who contacted this business through CarworX can review
        it.
      </p>
      {eligibility === "write" ? (
        <p>
          <Link to={`${pathname}/review`} className="pill">
            Write a review
          </Link>
        </p>
      ) : null}
      {eligibility === "message_first" ? (
        <div className="review-note">
          <p>
            <strong>Message them first.</strong>
          </p>
          <p className="small muted">
            Only customers who contacted {business} through CarworX can review
            it. That keeps reviews from real customers.
          </p>
          <a href="#enquiry" className="pill">
            Send a message
          </a>
        </div>
      ) : null}
      {eligibility === "sign_in" ? (
        <p className="small">
          <a href={`/auth/sign-in?returnTo=${encodeURIComponent(pathname)}`}>
            Sign in
          </a>{" "}
          to write a review once you have messaged {business}.
        </p>
      ) : null}
      {reviews.length === 0 ? (
        <div className="empty">
          <p>No reviews yet.</p>
          <p className="small muted">
            {business} is new on CarworX. Customers who send them a message can
            leave the first review.
          </p>
          <a href="#enquiry" className="pill">
            Send a message
          </a>
        </div>
      ) : (
        <>
          <ReviewSummary
            reviews={reviews}
            business={business}
            aggregate={aggregate}
          />
          <SortChips current={sort} pathname={pathname} />
          {reviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              business={business}
              reportTo={`${pathname}/reviews/${review.id}/report`}
              csrf={csrf}
            />
          ))}
        </>
      )}
    </section>
  );
}
