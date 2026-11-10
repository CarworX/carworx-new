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
      <h1 className="type-display-lg max-sm:text-[34px] max-sm:leading-[36px]">
        {m.kind === "results"
          ? `${categoryLabel(m.category)} near ${m.near || "you"}`
          : "Find a car service"}
      </h1>
      <div className="mt-6">
        <SearchForm
          {...formDefaults}
          {...("area" in m && m.kind !== "choose" ? { area: m.area } : {})}
          {...(m.kind === "results"
            ? { point: { lat: m.lat, lng: m.lng, near: m.near } }
            : {})}
        />
      </div>
      <div className="mt-8 grid gap-4">
        <Body m={m} />
      </div>
    </PublicShell>
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
      <nav aria-label="Distance" className="flex flex-wrap gap-2">
        {m.radiusLinks.map((r) => (
          <a
            key={r.radius}
            href={r.href}
            className="cx-chip"
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
            <ButtonLink href="/" variant="secondary">
              Try another area
            </ButtonLink>
          }
        >
          We're adding providers area by area. Soon you'll be able to tell us
          you need one here.
        </EmptyState>
      ) : null}
      {m.body.fixed !== null && fixed.length > 0 ? (
        <section aria-labelledby="fixed-h" className="grid gap-3">
          <h2 id="fixed-h" className="type-heading">
            Workshops you visit
          </h2>
          <p className="type-body-sm text-quiet">
            Sorted by straight-line distance.
          </p>
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
          <h2 id="mobile-h" className="type-heading">
            Providers who come to you
          </h2>
          <p className="type-body-sm text-quiet">
            They serve your approximate area. Coverage is confirmed before any
            booking.
          </p>
          {mobile.map((p) => (
            <ListingResult
              key={p.public_id}
              listing={{ ...p, mode: "mobile" }}
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
