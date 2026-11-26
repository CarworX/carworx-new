import "./cover.css";
import { topCategoryOf } from "../catalogue/taxonomy";
import {
  reviewRatingText,
  whereText,
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
 * One listing card (redesign A3/A4, B-06): the whole card is one link. The cover
 * photo when the business has one, else the service object on a tint. A
 * "Comes to you" for mobile providers, and each verification label as written. Place, distance and service are the same text as before.
 */
export function ListingCard({
  listing,
  matched = false,
}: {
  listing: ListingSummary;
  matched?: boolean;
}) {
  const key = topCategoryOf(listing.category_slug)?.key ?? "repairs";
  const icon = SERVICES.find((s) => s.key === key)?.object ?? "";
  const tint = tintFor(listing.public_id);
  const rating = reviewRatingText(listing);
  return (
    <a className="cx-lcard" href={`/p/${listing.public_id}`}>
      <span className={tint === "" ? "cover" : `cover ${tint}`}>
        {listing.cover_key ? (
          <img
            className="photo"
            src={`/media/${listing.cover_key}`}
            alt=""
            loading="lazy"
            data-cover
          />
        ) : (
          <img className="obj" src={icon} alt="" />
        )}
        {listing.mode === "mobile" ? (
          <span className="dist">Comes to you</span>
        ) : null}
      </span>
      <span className="body">
        <h3>{listing.display_name}</h3>
        {rating && <span className="meta">{rating}</span>}
        {/* The labels say exactly what CarworX checked: shown as written. */}
        {listing.verification_labels.map((label) => (
          <span key={label} className="cx-badge ok">
            {label}
          </span>
        ))}
        <span className="meta">{whereText(listing, matched)}</span>
        <span className="svc">{listing.service_name}</span>
      </span>
    </a>
  );
}
