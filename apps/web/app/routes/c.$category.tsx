import { data } from "react-router";

import { CATEGORIES, findCategory, slugsFor } from "../catalogue/taxonomy";
import {
  CatalogueUnavailable,
  listingsInCategories,
  type PublicListing,
} from "../server/catalogue/public";
import { ListingCard } from "../sites/ListingCard";
import { SITES_LINKS, SitesShell } from "../sites/SitesShell";
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

/** A category in the preview's search markup (app.js `search()` + `tabs()`). */
export default function CategoryPage({ loaderData }: Route.ComponentProps) {
  const { category, items, next, unavailable } = loaderData;
  return (
    <SitesShell>
      <div className="eyebrow">Browse a service</div>
      <h1 className="title">{category.label}</h1>
      <p className="lead">
        {SUB[category.slug] ?? ""}
        {category.children.length > 0
          ? ` Includes ${category.children.map((c) => c.label).join(", ")}.`
          : ""}
      </p>
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
      <div className="layout">
        <div className="stack">
          <form className="card" method="get" action="/search">
            <label htmlFor="location">
              <strong>Where do you need a service?</strong>
            </label>
            <p className="muted small">
              Enter a suburb, town or postcode to see the nearest first. Used
              only for this search, not stored.
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
          <div className="between">
            <div>
              <h2>Listed providers</h2>
              <p className="muted small">
                Not sorted by where you are. Search above for the nearest.
              </p>
            </div>
            {!unavailable && items.length > 0 ? (
              <span className="tag gray">
                {items.length === 1
                  ? "1 listed"
                  : `${String(items.length)} listed`}
              </span>
            ) : null}
          </div>
          {unavailable ? (
            <div className="notice" role="status">
              <strong>Listings can't load right now.</strong> Please try again
              in a moment.
            </div>
          ) : items.length === 0 ? (
            <article className="card">
              <h2>No providers listed here yet.</h2>
              <p>
                We are adding providers area by area. Search near you to see who
                serves your area.
              </p>
            </article>
          ) : (
            items.map((listing) => (
              <ListingCard key={listing.public_id} listing={listing} />
            ))
          )}
          {next ? (
            <a
              className="btn secondary"
              href={`/c/${category.slug}?after=${encodeURIComponent(next)}`}
            >
              More providers →
            </a>
          ) : null}
        </div>
        <aside className="card summary">
          <span className="eyebrow">Browsing</span>
          <h3>{category.label}</h3>
          <div>
            <span>Order</span>
            <strong>Not by distance</strong>
          </div>
          <div>
            <span>Cost to search</span>
            <strong>R0</strong>
          </div>
          <hr className="rule" />
          <p className="muted small">
            This list isn't filtered by your location, so it doesn't show who
            covers you. Search with your suburb to see the nearest workshops and
            the mobile providers who cover you.
          </p>
        </aside>
      </div>
    </SitesShell>
  );
}
