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

/** One listing in a list. Mobile providers never show a distance or place. */
export function ListingResult({ listing }: { listing: ListingSummary }) {
  const key = topCategoryOf(listing.category_slug)?.key ?? "repairs";
  const thumb = SERVICES.find((s) => s.key === key)?.object ?? "";
  const where =
    listing.mode === "mobile"
      ? "Comes to you · serves your area (approximate)"
      : listing.distance_km !== undefined && listing.distance_km !== null
        ? `${listing.metro} · ${listing.distance_km.toFixed(1)} km straight-line`
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
