import { data } from "react-router";

import { CATEGORIES, findCategory, slugsFor } from "../catalogue/taxonomy";
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
      <header className="cx-pagehead">
        <span className="cx-eyebrow">Browse a service</span>
        <h1>{category.label}</h1>
        <p className="lede">
          {category.children.length > 0
            ? `Includes ${category.children.map((c) => c.label).join(", ")}.`
            : "Every business listed for this service. Search near you to sort by distance."}
        </p>
        <nav aria-label="Services" className="cx-pills">
          {CATEGORIES.map((c) => (
            <a
              key={c.slug}
              href={`/c/${c.slug}`}
              aria-current={c.slug === category.slug ? "page" : undefined}
            >
              {c.label}
            </a>
          ))}
        </nav>
      </header>
      <div className="mt-8">
        <SearchForm category={category.slug} />
      </div>
      <div className="cx-split">
        <div className="main">
          <div className="cx-group-head">
            <h2>Listed providers</h2>
            {!unavailable && items.length > 0 ? (
              <span className="n">{items.length} shown</span>
            ) : null}
          </div>
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
          {next ? (
            <div>
              <ButtonLink
                href={`/c/${category.slug}?after=${encodeURIComponent(next)}`}
                variant="secondary"
                arrow
              >
                More providers
              </ButtonLink>
            </div>
          ) : null}
        </div>
        <aside className="cx-aside" aria-labelledby="browse-h">
          <span className="cx-eyebrow">Browsing</span>
          <h2 id="browse-h">Not sorted by where you are</h2>
          <p className="fine">
            This list isn't filtered by your location, so it doesn't show who
            covers you. Search with your suburb above to see the nearest
            workshops and the mobile providers who cover you.
          </p>
        </aside>
      </div>
    </PublicShell>
  );
}
