import { data } from "react-router";

import { CATEGORIES, findCategory, slugsFor } from "../catalogue/taxonomy";
import {
  CatalogueUnavailable,
  listingsInCategories,
  type PublicListing,
} from "../server/catalogue/public";
import { topCategoryOf } from "../catalogue/taxonomy";
import { ListingCard } from "../sites/ListingCard";
import { SITES_LINKS, SitesShell } from "../sites/SitesShell";
import { SERVICES } from "../ui/services";
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

const SUB: Record<string, string> = {
  "wash-and-detailing": "A little care goes a long way.",
  "repairs-and-maintenance": "Keep your car moving.",
  "glass-repair-and-replacement": "Clear answers for chips and cracks.",
  "tyres-and-wheel-alignment": "A smoother, safer drive.",
};

export const links: Route.LinksFunction = () => [...SITES_LINKS];

/** A category page (redesign A3, B-06): the category hero, one full-width grid of cards. */
export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { category, items, next, unavailable } = loaderData;
  const icon =
    SERVICES.find((s) => s.key === topCategoryOf(category.slug)?.key)?.object ??
    "";
  return (
    <SitesShell>
      <nav className="cx-crumbs" aria-label="Breadcrumb">
        <a href="/">Home</a> / <a href="/#services">Find a service</a> /{" "}
        <span aria-current="page">{category.label}</span>
      </nav>
      <section className="cx-cathero">
        <span className="keyobj" aria-hidden="true">
          <img src={icon} alt="" />
        </span>
        <div>
          <h1>{category.label}</h1>
          <p>{SUB[category.slug] ?? ""}</p>
        </div>
        <a className="cx-loc unset" href="#location">
          Set a location
        </a>
      </section>
      <div className="service-tabs" aria-label="Service categories">
        {CATEGORIES.map((c) => (
          <a
            key={c.slug}
            className={c.slug === category.slug ? "chip active" : "chip"}
            href={`/c/${c.slug}`}
            aria-current={c.slug === category.slug ? "page" : undefined}
          >
            {c.label}
          </a>
        ))}
        <a className="chip" href="/fines">
          Fines &amp; Vehicle Admin
        </a>
      </div>
      <form className="card" method="get" action="/search" id="location-form">
        <label htmlFor="location">
          <strong>Where do you need a service?</strong>
        </label>
        <p className="muted small">
          Enter a suburb, town or postcode to see the nearest first. Used only
          for this search, not stored.
        </p>
        <div className="searchbox">
          <input
            name="area"
            id="location"
            maxLength={80}
            autoComplete="address-level2"
            required
          />
          <button className="btn" type="submit">
            Search nearby →
          </button>
        </div>
        <input type="hidden" name="category" value={category.slug} />
      </form>
      <div className="cx-filterbar" role="status">
        {unavailable ? null : (
          <span>
            {items.length === 1
              ? "1 business listed"
              : `${String(items.length)} businesses listed`}
          </span>
        )}
        <span className="count">Not sorted by where you are</span>
      </div>
      {unavailable ? (
        <div className="notice" role="status">
          <strong>Listings can't load right now.</strong> Please try again in a
          moment.
        </div>
      ) : items.length === 0 ? (
        <div className="cx-empty">
          <h2>No businesses listed here yet.</h2>
          <p>
            We're adding businesses every week. Search near you to see who
            serves your area.
          </p>
          <a className="cx-btn secondary" href="#location">
            Change location
          </a>
        </div>
      ) : (
        <div className="cx-lgrid">
          {items.map((listing) => (
            <ListingCard key={listing.public_id} listing={listing} />
          ))}
        </div>
      )}
      {next ? (
        <a
          className="cx-btn secondary"
          href={`/c/${category.slug}?after=${encodeURIComponent(next)}`}
        >
          Show more businesses
        </a>
      ) : null}
    </SitesShell>
  );
}
