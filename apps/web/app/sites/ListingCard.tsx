import "./cover.css";
import "./listing-card.css";
import { cardStatus, hoursChip, statusLabel } from "../catalogue/card-status";
import { localClock, type HoursRow } from "../catalogue/hours";
import { topCategoryOf } from "../catalogue/taxonomy";
import {
  RatingLine,
  reviewRatingText,
  type ListingSummary,
} from "../ui/public/ListingResult";
import { SERVICES } from "../ui/services";

const TINTS = ["", "t2", "t3", "t4"] as const;

/** A stable tint from the listing id, so a card keeps its colour on every visit. */
export function tintFor(id: string): string {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length] ?? "";
}

/**
 * The save heart needs a saved-listings table, which does not exist yet. It
 * stays off until that API is live (listing card brief, step 5).
 */
export const SAVED_LISTINGS_ENABLED: boolean = false;

/** Two letters for a business without a photo: "Marula Motorworks" → "MM". */
export function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.length > 0);
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/** Km with one decimal, for fixed premises only; mobile never shows a distance (K6). */
function distanceText(listing: ListingSummary): string | null {
  if (listing.mode === "mobile") return null;
  if (typeof listing.distance_km !== "number") return null;
  return `${listing.distance_km.toFixed(1)} km`;
}

/**
 * The open status on the photo: a marker drawn as a shape (filled, half, slashed,
 * hollow), then the words. Colour is never the only cue.
 */
function StatusPill({
  status,
  day,
}: {
  status: ReturnType<typeof cardStatus>;
  day: number;
}) {
  return (
    <span className={`cx-openstate ${status.kind}`}>
      <span className="marker" aria-hidden="true" />
      {statusLabel(status, day)}
    </span>
  );
}

/**
 * The service artwork for a business without a photo. Only glass has a line
 * illustration in the repo that matches the mockup; the others show the tint
 * and initials until their illustrations are exported.
 */
export function illustrationFor(categorySlug: string): string | null {
  const key = topCategoryOf(categorySlug)?.key;
  if (key !== "glass") return null;
  return SERVICES.find((s) => s.key === key)?.object ?? null;
}

/**
 * One listing card (listing card redesign, Option A): the photo fills the top
 * with the open status on it, then the name, rating, where and what, and one
 * extra chip. The whole card is one link; the Verified badge (a disclosure) and
 * the save heart sit outside it, so each keeps its own action.
 */
export function ListingCard({
  listing,
  matched = false,
  hours = [],
  now = new Date(),
}: {
  listing: ListingSummary;
  matched?: boolean;
  /** The listing's opening hours when the read has them; none yet in search results. */
  hours?: readonly HoursRow[];
  now?: Date;
}) {
  const illustration = illustrationFor(listing.category_slug);
  const tint = tintFor(listing.public_id);
  const rating = reviewRatingText(listing);
  const status = cardStatus(hours, now);
  const day = localClock(now).day;
  const extra = hoursChip(hours);
  const distance = distanceText(listing);
  const checks = listing.verification_labels;
  const coverClass = tint === "" ? "cover" : `cover ${tint}`;

  return (
    <article className="cx-lcard">
      <a
        className="cx-lcard-link"
        href={`/p/${listing.public_id}`}
        aria-label={listing.display_name}
      >
        <span className={coverClass}>
          {listing.cover_key ? (
            <img
              className="photo"
              src={`/media/${listing.cover_key}`}
              alt=""
              loading="lazy"
              data-cover
            />
          ) : (
            <>
              {illustration ? (
                <img className="obj" src={illustration} alt="" />
              ) : null}
              <span className="initials" aria-hidden="true">
                {initialsOf(listing.display_name)}
              </span>
            </>
          )}
          <span className="status-on-photo">
            <StatusPill status={status} day={day} />
          </span>
        </span>
        <span className="body">
          <h3>{listing.display_name}</h3>
          {rating && <RatingLine listing={listing} className="meta" />}
          <span className="where">
            {listing.mode === "mobile" ? (
              <>
                Comes to you
                {matched ? (
                  <>
                    {" · "}
                    <span className="covers">✓ Covers your area</span>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {listing.mode === "both"
                  ? "Visit or comes to you"
                  : "Visit them"}
                {" · "}
                {listing.metro}
                {distance ? (
                  <>
                    {" · "}
                    {distance}
                    <span className="sr-only"> straight-line</span>
                  </>
                ) : null}
              </>
            )}
          </span>
          <span className="card-chips">
            <span className="chip">{listing.service_name}</span>
            {extra ? <span className="chip outline">{extra}</span> : null}
          </span>
        </span>
      </a>
      {checks.length > 0 ? (
        <details className="cx-verified">
          <summary>
            <span aria-hidden="true">✓</span> Verified{" "}
            <span className="count">{checks.length}</span>
            <span className="sr-only"> checks</span>
          </summary>
          <ul>
            {checks.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {SAVED_LISTINGS_ENABLED ? (
        <button
          type="button"
          className="cx-save"
          aria-label={`Save ${listing.display_name}`}
        >
          ♡
        </button>
      ) : null}
    </article>
  );
}
