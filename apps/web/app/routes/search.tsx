import { data } from "react-router";

import { CATEGORIES, findCategory } from "../catalogue/taxonomy";
import { geocodeArea } from "../server/geo/geocode";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "../server/search/limiter";
import { buildSearchPage, type PageModel } from "../server/search/page";
import { ButtonLink, TextLink } from "../ui/Button";
import { EmptyState, StatusNote } from "../ui/Note";
import { ListingResult } from "../ui/public/ListingResult";
import { PublicShell } from "../ui/public/PublicShell";
import { SearchForm } from "../ui/public/SearchForm";
import type { Route } from "./+types/search";

interface SearchEnv {
  CATALOGUE_DB?: { connectionString?: unknown };
  SEARCH_LIMITER?: LimiterNamespace;
  SEARCH_LIMITER_SALT?: string;
  SEARCH_CURSOR_KEY?: string;
  MAPBOX_SERVER_TOKEN?: string;
}

const STATUS: Partial<Record<PageModel["kind"], number>> = {
  rate_limited: 429,
  unavailable: 503,
  bad_request: 400,
};

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env as unknown as SearchEnv;
  const connection = env.CATALOGUE_DB?.connectionString;
  const search =
    typeof connection === "string" && connection.length > 0
      ? (await import("../server/search/db")).createCatalogueSearch(connection)
      : undefined;
  const { model, cookie } = await buildSearchPage(request, {
    cursorKey: env.SEARCH_CURSOR_KEY,
    limits: (ip, session) =>
      checkSearchLimits(
        env.SEARCH_LIMITER,
        env.SEARCH_LIMITER_SALT,
        ip,
        session,
      ),
    search,
    quota: () => checkQuota(env.SEARCH_LIMITER, "geocode"),
    geocode: (area) => geocodeArea(area, env.MAPBOX_SERVER_TOKEN),
    mapEnabled:
      typeof env.MAPBOX_SERVER_TOKEN === "string" &&
      env.MAPBOX_SERVER_TOKEN.length >= 20,
  });
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  if (model.kind === "rate_limited")
    headers.set("Retry-After", String(model.retryAfterSeconds));
  return data(model, { status: STATUS[model.kind] ?? 200, headers });
}

/** Search results reveal a location: never cached anywhere. */
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "private, no-store",
});

export const meta: Route.MetaFunction = () => [
  { title: "Search · CarworX" },
  { name: "robots", content: "noindex" },
];

function countLabel(n: number) {
  return n === 1 ? "1 shown" : `${String(n)} shown`;
}

function categoryLabel(slug: string) {
  return findCategory(slug)?.label ?? "All services";
}

export default function SearchPage({ loaderData: m }: Route.ComponentProps) {
  const formDefaults =
    "category" in m && "radius" in m
      ? { category: m.category, radius: m.radius }
      : {};
  return (
    <PublicShell current="/">
      <header className="cx-pagehead">
        <span className="cx-eyebrow">Find a service</span>
        <h1>
          {m.kind === "results"
            ? `${categoryLabel(m.category)} near ${m.near || "you"}`
            : "Find a car service"}
        </h1>
        <p className="lede">
          {m.kind === "results"
            ? "Nearest first. Every label says exactly what we checked."
            : "Workshops you can visit and mobile providers who come to you. Free to search, no account needed."}
        </p>
        <nav aria-label="Services" className="cx-pills">
          {m.kind === "results"
            ? m.categoryLinks.map((c) => (
                <a
                  key={c.slug || "all"}
                  href={c.href}
                  aria-current={c.current ? "page" : undefined}
                >
                  {c.label}
                </a>
              ))
            : CATEGORIES.map((c) => (
                <a key={c.slug} href={`/c/${c.slug}`}>
                  {c.label}
                </a>
              ))}
        </nav>
      </header>
      <div className="mt-8">
        <SearchForm
          {...formDefaults}
          {...("area" in m && m.kind !== "choose" ? { area: m.area } : {})}
          {...(m.kind === "results"
            ? { point: { lat: m.lat, lng: m.lng, near: m.near } }
            : {})}
        />
      </div>
      <div className="cx-split">
        <div className="main">
          <Body m={m} />
        </div>
        <Aside m={m} />
      </div>
    </PublicShell>
  );
}

/** The preview's side card: what this search is, in plain words. */
function Aside({ m }: { m: PageModel }) {
  if (m.kind === "results")
    return (
      <aside className="cx-aside" aria-labelledby="about-h">
        <span className="cx-eyebrow">This search</span>
        <h2 id="about-h">{categoryLabel(m.category)}</h2>
        <dl>
          <div>
            <dt>Area</dt>
            <dd>{m.near || "Your location"}</dd>
          </div>
          <div>
            <dt>Distance</dt>
            <dd>Within {m.radius} km</dd>
          </div>
          <div>
            <dt>Order</dt>
            <dd>Nearest first</dd>
          </div>
        </dl>
        <p className="fine">
          Distances are straight-line. Mobile providers show their region, never
          an address. Your location is used for this search only.
        </p>
      </aside>
    );
  return (
    <aside className="cx-aside" aria-labelledby="about-h">
      <span className="cx-eyebrow">How search works</span>
      <h2 id="about-h">Free, and nothing to sign up for</h2>
      <dl>
        <div>
          <dt>Cost to search</dt>
          <dd>R0</dd>
        </div>
        <div>
          <dt>Account</dt>
          <dd>Not needed</dd>
        </div>
        <div>
          <dt>Your location</dt>
          <dd>Not stored</dd>
        </div>
      </dl>
      <p className="fine">
        Every label on a listing says exactly what CarworX checked, and when.
      </p>
    </aside>
  );
}

function Body({ m }: { m: PageModel }) {
  switch (m.kind) {
    case "start":
      return (
        <p className="type-body text-quiet">
          Type your suburb, town or postcode, or use your location.
        </p>
      );
    case "invalid_area":
      return (
        <StatusNote tone="warn" title="Check the area name.">
          Use letters, numbers and spaces only, up to 80 characters.
        </StatusNote>
      );
    case "no_area":
      return (
        <StatusNote tone="warn" title={`We couldn't find "${m.area}".`}>
          Try a nearby suburb or town, or your postcode.
        </StatusNote>
      );
    case "area_unavailable":
      return (
        <StatusNote tone="warn" title="Area search isn't available right now.">
          Tap “Use my location”, or try again later.
        </StatusNote>
      );
    case "choose":
      return (
        <section aria-labelledby="choose-h">
          <h2 id="choose-h" className="type-heading">
            Which “{m.area}” did you mean?
          </h2>
          <ul className="mt-3 grid gap-2">
            {m.choices.map((c) => (
              <li key={c.href}>
                <TextLink href={c.href}>{c.label}</TextLink>
              </li>
            ))}
          </ul>
        </section>
      );
    case "rate_limited":
      return (
        <StatusNote tone="warn" title="Too many searches.">
          Please wait {m.retryAfterSeconds} seconds and try again.
        </StatusNote>
      );
    case "unavailable":
      return (
        <StatusNote tone="err" title="Search isn't available right now.">
          Please try again in a moment.
        </StatusNote>
      );
    case "bad_request":
      return (
        <StatusNote tone="warn" title="That search link has expired.">
          Search again from the form above.
        </StatusNote>
      );
    case "results":
      return <Results m={m} />;
  }
}

function Results({ m }: { m: Extract<PageModel, { kind: "results" }> }) {
  const fixed = m.body.fixed?.items ?? [];
  const mobile = m.body.mobile?.items ?? [];
  const nothing = fixed.length === 0 && mobile.length === 0;
  return (
    <>
      <nav aria-label="Distance" className="cx-pills !mt-0">
        {m.radiusLinks.map((r) => (
          <a
            key={r.radius}
            href={r.href}
            aria-current={r.current ? "true" : undefined}
          >
            Within {r.radius} km
          </a>
        ))}
      </nav>
      {nothing ? (
        <EmptyState
          title="No providers found here yet."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink
                href={`/demand?category=${encodeURIComponent(m.category)}`}
                variant="primary"
              >
                Tell me when one joins
              </ButtonLink>
              <ButtonLink href="/" variant="secondary">
                Try another area
              </ButtonLink>
            </div>
          }
        >
          We're adding providers area by area. This doesn't mean there are none
          near you, only that none are listed with us yet.
        </EmptyState>
      ) : null}
      {m.body.fixed !== null && fixed.length > 0 ? (
        <section aria-labelledby="fixed-h" className="grid gap-3">
          <div className="cx-group-head">
            <h2 id="fixed-h">Workshops you visit</h2>
            <span className="n">{countLabel(fixed.length)}</span>
          </div>
          <p className="cx-group-note">Sorted by straight-line distance.</p>
          {m.mapImage ? (
            <figure className="grid gap-2">
              <img
                src={m.mapImage}
                width={640}
                height={360}
                className="h-auto w-full rounded-2xl"
                alt="Map of the workshops listed below. Mobile providers are not shown on the map."
              />
              <figcaption className="type-caption text-quiet">
                Map shows workshops only. The list has every result.
              </figcaption>
            </figure>
          ) : m.showMap ? (
            <div>
              <TextLink href={m.showMap}>Show workshops on a map</TextLink>
            </div>
          ) : null}
          {fixed.map((f) => (
            <ListingResult
              key={f.public_id}
              listing={{ ...f, mode: "fixed" }}
              matched
            />
          ))}
          {m.moreFixed ? (
            <ButtonLink href={m.moreFixed} variant="secondary" arrow>
              More workshops
            </ButtonLink>
          ) : null}
        </section>
      ) : null}
      {m.body.mobile !== null && mobile.length > 0 ? (
        <section aria-labelledby="mobile-h" className="grid gap-3">
          <div className="cx-group-head">
            <h2 id="mobile-h">Providers who come to you</h2>
            <span className="n">{countLabel(mobile.length)}</span>
          </div>
          <p className="cx-group-note">
            They serve your approximate area. Coverage is confirmed before any
            booking.
          </p>
          {mobile.map((p) => (
            <ListingResult
              key={p.public_id}
              listing={{ ...p, mode: p.also_premises ? "both" : "mobile" }}
              matched
            />
          ))}
          {m.moreMobile ? (
            <ButtonLink href={m.moreMobile} variant="secondary" arrow>
              More mobile providers
            </ButtonLink>
          ) : null}
        </section>
      ) : null}
      <p className="type-caption text-quiet">
        Showing {categoryLabel(m.category)} within {m.radius} km. Other
        services: {CATEGORIES.map((c) => c.label).join(" · ")}.
      </p>
    </>
  );
}
