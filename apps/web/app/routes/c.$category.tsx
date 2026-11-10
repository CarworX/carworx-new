import { data } from "react-router";

import { findCategory, slugsFor } from "../catalogue/taxonomy";
import {
  CatalogueUnavailable,
  listingsInCategories,
  type PublicListing,
} from "../server/catalogue/public";
import { ButtonLink } from "../ui/Button";
import { EmptyState, StatusNote } from "../ui/Note";
import { ListingResult } from "../ui/public/ListingResult";
import { PublicShell } from "../ui/public/PublicShell";
import { SearchForm } from "../ui/public/SearchForm";
import type { Route } from "./+types/c.$category";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const category = findCategory(params.category);
  if (!category) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw data(null, { status: 404 });
  }
  const config = context.security.config;
  const after = new URL(request.url).searchParams.get("after");
  const none = { category, items: [] as PublicListing[], next: null };
  if (!config)
    return data(
      { ...none, unavailable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const page = await listingsInCategories(config, slugsFor(category), after);
    return data(
      { category, ...page, unavailable: false },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  } catch (error) {
    if (!(error instanceof CatalogueUnavailable)) throw error;
    return data(
      { ...none, unavailable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control") ?? "no-store",
});

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData.category.label} · CarworX`,
    },
  ];
}

export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { category, items, next, unavailable } = loaderData;
  return (
    <PublicShell>
      <p className="cx-eyebrow">Browse</p>
      <h1 className="type-display-lg mt-2">{category.label}</h1>
      {category.children.length > 0 ? (
        <p className="type-body mt-2 text-quiet">
          Includes {category.children.map((c) => c.label).join(", ")}.
        </p>
      ) : null}
      <div className="mt-6">
        <SearchForm category={category.slug} />
      </div>
      <h2 className="type-heading mt-10">Listed providers</h2>
      <div className="mt-4 grid gap-3">
        {unavailable ? (
          <StatusNote tone="warn" title="Listings can't load right now.">
            Please try again in a moment.
          </StatusNote>
        ) : items.length === 0 ? (
          <EmptyState title="No providers listed here yet.">
            We are adding providers area by area. Search near you to see who
            serves your area.
          </EmptyState>
        ) : (
          items.map((listing) => (
            <ListingResult key={listing.public_id} listing={listing} />
          ))
        )}
      </div>
      {next ? (
        <div className="mt-6">
          <ButtonLink
            href={`/c/${category.slug}?after=${encodeURIComponent(next)}`}
            variant="secondary"
            arrow
          >
            More providers
          </ButtonLink>
        </div>
      ) : null}
    </PublicShell>
  );
}
