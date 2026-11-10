import { data } from "react-router";

import { topCategoryOf } from "../catalogue/taxonomy";
import { CatalogueUnavailable, listingById } from "../server/catalogue/public";
import { TextLink } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/p.$publicId";

function unavailable(): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw data(null, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const config = context.security.config;
  if (!config) unavailable();
  let listing;
  try {
    listing = await listingById(config, params.publicId);
  } catch (error) {
    if (error instanceof CatalogueUnavailable) unavailable();
    throw error;
  }
  if (!listing) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw data(null, { status: 404 });
  }
  return data(
    { listing },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control") ?? "no-store",
});

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData.listing.display_name} · CarworX`,
    },
  ];
}

export default function ListingPage({ loaderData }: Route.ComponentProps) {
  const { listing } = loaderData;
  const category = topCategoryOf(listing.category_slug);
  return (
    <PublicShell>
      <p className="cx-eyebrow">
        {category ? (
          <TextLink href={`/c/${category.slug}`}>{category.label}</TextLink>
        ) : null}
        {category ? " · " : null}
        {listing.service_name}
      </p>
      <h1 className="type-display-lg mt-2">{listing.display_name}</h1>
      {listing.verification_labels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.verification_labels.map((label) => (
            <StatusLabel key={label}>{label}</StatusLabel>
          ))}
        </div>
      ) : null}
      <p className="type-body mt-4 max-w-[65ch]">{listing.description}</p>
      <div className="mt-6 max-w-[65ch]">
        {listing.mode === "fixed" ? (
          <StatusNote title="Visit the workshop.">
            {listing.public_address} · {listing.metro}
          </StatusNote>
        ) : (
          <StatusNote title="Comes to you.">
            Serves an area in {listing.metro}. Coverage is approximate; the
            provider confirms your exact address before any booking.
          </StatusNote>
        )}
      </div>
      <p className="mt-6">
        <TextLink href={`/provider/claim/${listing.public_id}`}>
          Is this your business? Claim this listing
        </TextLink>
      </p>
      <div className="mt-6">
        <StatusNote title="Enquiries open soon.">
          You'll be able to send this provider a message from this page.
        </StatusNote>
      </div>
    </PublicShell>
  );
}
