import { topCategoryOf } from "../../catalogue/taxonomy";
import { StatusLabel } from "../Chip";
import { Icon } from "../Icon";
import { SERVICES } from "../services";

export interface ListingSummary {
  public_id: string;
  display_name: string;
  metro: string;
  mode: string;
  service_name: string;
  category_slug: string;
  verification_labels: string[];
  /** Fixed premises in search only: 0.1 km straight-line distance. */
  distance_km?: number | null;
  /** R2 key of the cover photo (D-098), when the listing has one. */
  cover_key?: string | null;
  rating_avg?: number | null;
  rating_count?: number;
}

/** Five stars for an average, as glyphs; screen readers get the text beside them. */
export function ratingStars(average: number): string {
  const full = Math.min(5, Math.max(0, Math.round(average)));
  return "★".repeat(full) + "☆".repeat(5 - full);
}

/** The rating as a line: stars (when rated) then the count, or "New" with none. */
export function RatingLine({
  listing,
  className,
}: {
  listing: Pick<ListingSummary, "rating_avg" | "rating_count">;
  className?: string;
}) {
  const text = reviewRatingText(listing);
  if (text === null) return null;
  const rated =
    typeof listing.rating_avg === "number" && (listing.rating_count ?? 0) > 0;
  return (
    <span className={className}>
      {rated ? (
        <span className="rating-stars" aria-hidden="true">
          <span className="on">
            {"★".repeat(Math.round(listing.rating_avg ?? 0))}
          </span>
          <span className="off">
            {"★".repeat(5 - Math.round(listing.rating_avg ?? 0))}
          </span>{" "}
        </span>
      ) : null}
      {text}
    </span>
  );
}

export function reviewRatingText({
  rating_avg,
  rating_count,
}: Pick<ListingSummary, "rating_avg" | "rating_count">): string | null {
  if (rating_count === 0) return "New";
  if (!rating_count || typeof rating_avg !== "number") return null;
  return `${rating_avg.toFixed(1)} out of 5 · ${String(rating_count)} ${rating_count === 1 ? "review" : "reviews"}`;
}

/**
 * One listing in a list. Mobile providers never show a distance or place,
 * only their public service region. "Serves your area" is claimed only when
 * the card came from the location search (`matched`); browsing lists are not
 * filtered by the visitor's location, so they must not imply coverage.
 */
export function ListingResult({
  listing,
  matched = false,
}: {
  listing: ListingSummary;
  matched?: boolean;
}) {
  const key = topCategoryOf(listing.category_slug)?.key ?? "repairs";
  const thumb = SERVICES.find((s) => s.key === key)?.object ?? "";
  const where = whereText(listing, matched);
  return (
    <article className="cx-lcard">
      <div className="top">
        <span className="th">
          <img src={thumb} alt="" width={64} height={64} />
        </span>
        <div className="who">
          {listing.verification_labels.length > 0 ? (
            <div className="lbls">
              {listing.verification_labels.map((label) => (
                <StatusLabel key={label}>{label}</StatusLabel>
              ))}
            </div>
          ) : null}
          <h3>
            <a href={`/p/${listing.public_id}`}>{listing.display_name}</a>
          </h3>
          <p className="m">{where}</p>
        </div>
        <p className="pr">
          Free
          <small>to enquire</small>
        </p>
      </div>
      <div className="bot">
        <p className="svc">{listing.service_name}</p>
        <span className="go" aria-hidden="true">
          View business
          <Icon name="arrow" size="sm" />
        </span>
      </div>
    </article>
  );
}

/** Where a listing is, in words. Mobile providers never get a place or a
 * distance; browsing lists never claim coverage. */
export function whereText(listing: ListingSummary, matched: boolean): string {
  const hasDistance =
    listing.distance_km !== undefined && listing.distance_km !== null;
  // A both-business (premises and comes to you) found through its service
  // area shows no distance: only that it comes to you and has premises.
  return listing.mode === "mobile"
    ? matched
      ? `Comes to you · ${listing.metro} · serves your area (approximate)`
      : `Comes to you · ${listing.metro}`
    : listing.mode === "both" && !hasDistance
      ? matched
        ? `Comes to you · serves your area (approximate) · also has premises in ${listing.metro}`
        : `Comes to you · also has premises in ${listing.metro}`
      : hasDistance
        ? `${listing.metro} · ${(listing.distance_km ?? 0).toFixed(1)} km straight-line`
        : listing.metro;
}
