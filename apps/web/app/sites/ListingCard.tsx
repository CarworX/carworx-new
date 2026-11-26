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

/** "Open · closes 14:00": the state in bold, the time in regular weight. */
function StatusLabel({ text }: { text: string }) {
  const [lead, rest] = text.split(" · ");
  return (
    <span className="label">
      <b>{lead}</b>
      {rest ? ` · ${rest}` : ""}
    </span>
  );
}

/** Small line icons for the "where" row: a shopfront to visit, a van that comes to you. */
function WhereIcon({ mobile }: { mobile: boolean }) {
  return (
    <svg
      className="where-ic"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {mobile ? (
        <>
          <path d="M1.5 4h8v7h-8zM9.5 6.5h3l2 2.2V11h-5z" />
          <circle cx="4.5" cy="12" r="1.3" />
          <circle cx="11.7" cy="12" r="1.3" />
        </>
      ) : (
        <>
          <path d="M2.5 6.5v7h11v-7M1.5 3.5l1-2h11l1 2v1.2a1.7 1.7 0 0 1-3.2.8 1.7 1.7 0 0 1-3.2 0 1.7 1.7 0 0 1-3.2 0 1.7 1.7 0 0 1-3.2-.8z" />
          <path d="M6.5 13.5V10h3v3.5" />
        </>
      )}
    </svg>
  );
}

/** The shield with a tick, in the mockup's blue. */
function ShieldIcon() {
  return (
    <svg
      className="shield"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 1.6 2.8 3.5v4c0 3 2.1 5.4 5.2 6.9 3.1-1.5 5.2-3.9 5.2-6.9v-4L8 1.6Z" />
      <path d="m5.6 8 1.7 1.7L10.6 6.4" />
    </svg>
  );
}

/** A full 12 px marker per state: filled dot, clock, slashed circle, hollow ring. */
function StatusMarker({
  kind,
}: {
  kind: ReturnType<typeof cardStatus>["kind"];
}) {
  return (
    <svg
      className="marker"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      {kind === "open" ? (
        <circle cx="6" cy="6" r="5" fill="currentColor" stroke="none" />
      ) : null}
      {kind === "closing" ? (
        <>
          <circle cx="6" cy="6" r="5.25" />
          <path d="M6 3.2V6l1.9 1.2" />
        </>
      ) : null}
      {kind === "closed" ? (
        <>
          <circle cx="6" cy="6" r="5.25" />
          <path d="M2.4 9.6 9.6 2.4" />
        </>
      ) : null}
      {kind === "none" ? <circle cx="6" cy="6" r="5.25" /> : null}
    </svg>
  );
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
      <StatusMarker kind={status.kind} />
      <StatusLabel text={statusLabel(status, day)} />
    </span>
  );
}

/**
 * The service artwork for a business without a photo: the Studio object for its
 * top-level category (repairs covers panel and paint, auto electrical and mobile).
 */
export function illustrationFor(categorySlug: string): string | null {
  const key = topCategoryOf(categorySlug)?.key;
  if (!key) return null;
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
  // The same rules as whereText: a mobile provider never gets a distance, and
  // coverage is claimed only for a result that passed a location search.
  const whereKind =
    listing.mode === "mobile"
      ? "mobile"
      : listing.mode === "both" && distance === null
        ? "both-area"
        : "premises";
  const covers = matched ? (
    <>
      {" · "}
      <span className="covers" data-covers="">
        ✓ Covers your area
      </span>
    </>
  ) : null;
  const coverClass = tint === "" ? "cover" : `cover ${tint}`;

  return (
    <article className="cx-lcard">
      <div className="cx-lcard-main">
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
          <span className="nm">
            <h3>
              <a className="cx-lcard-link" href={`/p/${listing.public_id}`}>
                {listing.display_name}
              </a>
            </h3>
            {checks.length > 0 ? (
              <details className="cx-verified">
                <summary>
                  <ShieldIcon />
                  <span className="count" aria-hidden="true">
                    {checks.length}
                  </span>
                  <span className="sr-only">
                    Verified: {checks.length}{" "}
                    {checks.length === 1 ? "check" : "checks"}
                  </span>
                </summary>
                <div className="pop">
                  <b>What CarworX checked</b>
                  <ul>
                    {checks.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ) : null}
          </span>
          {rating === "New" ? (
            <span className="new">New</span>
          ) : rating ? (
            <RatingLine listing={listing} className="meta" />
          ) : null}
          <span className="where" data-where={whereKind}>
            <WhereIcon mobile={listing.mode === "mobile"} />
            {whereKind === "mobile" ? (
              <>
                <b>Comes to you</b>
                {` · ${listing.metro}`}
                {covers}
              </>
            ) : whereKind === "both-area" ? (
              <>
                <b>Comes to you</b>
                {covers}
                {` · also has premises in ${listing.metro}`}
              </>
            ) : (
              <>
                <b>
                  {listing.mode === "both"
                    ? "Visit or comes to you"
                    : "Visit them"}
                </b>
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
      </div>
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
