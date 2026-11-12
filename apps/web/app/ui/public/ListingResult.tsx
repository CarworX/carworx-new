import { topCategoryOf } from "../../catalogue/taxonomy";
import { StatusLabel } from "../Chip";
import { ResultCard } from "../ResultCard";
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
  const hasDistance =
    listing.distance_km !== undefined && listing.distance_km !== null;
  // A both-business (premises and comes to you) found through its service
  // area shows no distance: only that it comes to you and has premises.
  const where =
    listing.mode === "mobile"
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
  return (
    <ResultCard
      name={listing.display_name}
      href={`/p/${listing.public_id}`}
      meta={`${listing.service_name} · ${where}`}
      thumb={thumb}
      price="Enquire"
      labels={
        listing.verification_labels.length > 0 ? (
          <>
            {listing.verification_labels.map((label) => (
              <StatusLabel key={label}>{label}</StatusLabel>
            ))}
          </>
        ) : undefined
      }
    />
  );
}
