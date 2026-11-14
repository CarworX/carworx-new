import { data } from "react-router";

import { CATEGORIES, findCategory } from "../catalogue/taxonomy";
import { geocodeArea } from "../server/geo/geocode";
import {
  checkQuota,
  checkSearchLimits,
  type LimiterNamespace,
} from "../server/search/limiter";
import { buildSearchPage, type PageModel } from "../server/search/page";
import { ListingCard } from "../sites/ListingCard";
import { SITES_LINKS, SitesShell } from "../sites/SitesShell";
import { UseMyLocation } from "../sites/UseMyLocation";
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

const SUB: Record<string, string> = {
  "": "Washes, repairs, glass and tyres from businesses near you.",
  "wash-and-detailing": "A little care goes a long way.",
  "repairs-and-maintenance": "Keep your car moving.",
  "glass-repair-and-replacement": "Clear answers for chips and cracks.",
  "tyres-and-wheel-alignment": "A smoother, safer drive.",
};

function categoryLabel(slug: string) {
  return findCategory(slug)?.label ?? "All services";
}

export const links: Route.LinksFunction = () => [...SITES_LINKS];

/** The preview's search screen (app.js `search()`), with the real search. */
export default function SearchPage({ loaderData: m }: Route.ComponentProps) {
  const category = "category" in m ? m.category : "";
  const tabs =
    m.kind === "results"
      ? m.categoryLinks.map((c) => ({ ...c }))
      : CATEGORIES.map((c) => ({
          slug: c.slug,
          label: c.label,
          href: `/c/${c.slug}`,
          current: false,
        }));
  return (
    <SitesShell>
      <div className="eyebrow">Find a service</div>
      <h1 className="title">
        {m.kind === "results"
          ? categoryLabel(m.category)
          : "Find a car service"}
      </h1>
      <p className="lead">{SUB[category] ?? SUB[""]}</p>
      <div className="service-tabs" aria-label="Service categories">
        {tabs.map((t) => (
          <a
            key={t.slug || "all"}
            className={t.current ? "chip active" : "chip"}
            href={t.href}
            aria-current={t.current ? "page" : undefined}
          >
            {t.label}
          </a>
        ))}
        <a className="chip" href="/fines">
          Fines &amp; Vehicle Admin
        </a>
      </div>
      <div className="layout">
        <div className="stack">
          <SearchCard m={m} />
          <Body m={m} />
        </div>
        <Summary m={m} />
      </div>
    </SitesShell>
  );
}

function SearchCard({ m }: { m: PageModel }) {
  const area = "area" in m && m.kind !== "choose" ? m.area : "";
  return (
    <form className="card" id="search-form" method="get" action="/search">
      <label htmlFor="location">
        <strong>Where do you need a service?</strong>
      </label>
      <p className="muted small">
        {m.kind === "results"
          ? `Leave empty to keep searching near ${m.near || "your location"}. Not stored.`
          : "Enter a suburb, town or postcode. Used only for this search, not stored."}
      </p>
      <div className="searchbox">
        <input
          name="area"
          id="location"
          defaultValue={area}
          maxLength={80}
          autoComplete="address-level2"
          required={m.kind !== "results"}
        />
        <button className="btn" type="submit">
          Search nearby →
        </button>
      </div>
      {"category" in m && m.category ? (
        <input type="hidden" name="category" value={m.category} />
      ) : null}
      {"radius" in m ? (
        <input type="hidden" name="radius" value={m.radius} />
      ) : null}
      <input
        type="hidden"
        name="lat"
        defaultValue={m.kind === "results" ? m.lat : ""}
      />
      <input
        type="hidden"
        name="lng"
        defaultValue={m.kind === "results" ? m.lng : ""}
      />
      {m.kind === "results" ? (
        <input type="hidden" name="near" value={m.near} />
      ) : null}
      <UseMyLocation formId="search-form" />
    </form>
  );
}

function Notice({
  tone = "",
  children,
}: {
  tone?: "" | "blue" | "green";
  children: React.ReactNode;
}) {
  return (
    <div className={tone ? `notice ${tone}` : "notice"} role="status">
      {children}
    </div>
  );
}

function Body({ m }: { m: PageModel }) {
  switch (m.kind) {
    case "start":
      return (
        <Notice tone="blue">
          Type your suburb, town or postcode to see businesses near you.
        </Notice>
      );
    case "invalid_area":
      return (
        <Notice>
          <strong>Check the area name.</strong> Use letters, numbers and spaces
          only, up to 80 characters.
        </Notice>
      );
    case "no_area":
      return (
        <Notice>
          <strong>We couldn't find "{m.area}".</strong> Try a nearby suburb or
          town, or your postcode.
        </Notice>
      );
    case "area_unavailable":
      return (
        <Notice>
          <strong>Area search isn't available right now.</strong> Please try
          again later.
        </Notice>
      );
    case "choose":
      return (
        <article className="card">
          <h2>Which “{m.area}” did you mean?</h2>
          <ul className="list">
            {m.choices.map((c) => (
              <li key={c.href}>
                <a href={c.href}>{c.label}</a>
              </li>
            ))}
          </ul>
        </article>
      );
    case "rate_limited":
      return (
        <Notice>
          <strong>Too many searches.</strong> Please wait {m.retryAfterSeconds}{" "}
          seconds and try again.
        </Notice>
      );
    case "unavailable":
      return (
        <Notice>
          <strong>Search isn't available right now.</strong> Please try again in
          a moment.
        </Notice>
      );
    case "bad_request":
      return (
        <Notice>
          <strong>That search link has expired.</strong> Search again from the
          form above.
        </Notice>
      );
    case "results":
      return <Results m={m} />;
  }
}

function Results({ m }: { m: Extract<PageModel, { kind: "results" }> }) {
  const fixed = m.body.fixed?.items ?? [];
  const mobile = m.body.mobile?.items ?? [];
  const total = fixed.length + mobile.length;
  return (
    <>
      <div className="between">
        <div>
          <h2>Businesses near {m.near || "you"}</h2>
          <p className="muted small">
            Distances are straight-line estimates · within {m.radius} km
          </p>
        </div>
        <span className="tag gray">
          {total === 1 ? "1 result" : `${String(total)} results`}
        </span>
      </div>
      <nav className="service-tabs" aria-label="Distance">
        {m.radiusLinks.map((r) => (
          <a
            key={r.radius}
            href={r.href}
            className={r.current ? "chip active" : "chip"}
            aria-current={r.current ? "true" : undefined}
          >
            Within {r.radius} km
          </a>
        ))}
      </nav>
      {total === 0 ? (
        <article className="card">
          <h2>No providers found here yet.</h2>
          <p>
            We're adding businesses area by area. This doesn't mean there are
            none near you, only that none are listed with us yet.
          </p>
          <div className="bar">
            <a
              className="btn"
              href={`/demand?category=${encodeURIComponent(m.category)}`}
            >
              Tell me when one joins →
            </a>
            <a className="btn secondary" href="/search">
              Try another area
            </a>
          </div>
        </article>
      ) : null}
      {m.body.fixed !== null && fixed.length > 0 ? (
        <section aria-labelledby="fixed-h" className="stack">
          <h3 id="fixed-h">Workshops you visit</h3>
          {m.mapImage ? (
            <figure className="card">
              <img
                src={m.mapImage}
                width={640}
                height={360}
                style={{ width: "100%", height: "auto", borderRadius: 12 }}
                alt="Map of the workshops listed below. Mobile providers are not shown on the map."
              />
              <figcaption className="small muted">
                Map shows workshops only. The list has every result.
              </figcaption>
            </figure>
          ) : m.showMap ? (
            <p className="small">
              <a href={m.showMap}>Show workshops on a map →</a>
            </p>
          ) : null}
          {fixed.map((f) => (
            <ListingCard
              key={f.public_id}
              listing={{ ...f, mode: "fixed" }}
              matched
            />
          ))}
          {m.moreFixed ? (
            <a className="btn secondary" href={m.moreFixed}>
              More workshops →
            </a>
          ) : null}
        </section>
      ) : null}
      {m.body.mobile !== null && mobile.length > 0 ? (
        <section aria-labelledby="mobile-h" className="stack">
          <h3 id="mobile-h">Providers who come to you</h3>
          <p className="muted small">
            They serve your approximate area. Coverage is confirmed before any
            booking.
          </p>
          {mobile.map((p) => (
            <ListingCard
              key={p.public_id}
              listing={{ ...p, mode: p.also_premises ? "both" : "mobile" }}
              matched
            />
          ))}
          {m.moreMobile ? (
            <a className="btn secondary" href={m.moreMobile}>
              More mobile providers →
            </a>
          ) : null}
        </section>
      ) : null}
      <Notice tone="blue">
        Can't find what you're looking for? Search another suburb, or{" "}
        <a href={`/demand?category=${encodeURIComponent(m.category)}`}>
          tell us what you need →
        </a>
      </Notice>
    </>
  );
}

/** The preview's summary card, describing this search. */
function Summary({ m }: { m: PageModel }) {
  return (
    <aside className="card summary">
      <span className="eyebrow">Your search</span>
      <h3>{"category" in m ? categoryLabel(m.category) : "All services"}</h3>
      <div>
        <span>Area</span>
        <strong>
          {m.kind === "results" ? m.near || "Your location" : "Not chosen yet"}
        </strong>
      </div>
      <div>
        <span>Distance</span>
        <strong>{"radius" in m ? `Within ${String(m.radius)} km` : "—"}</strong>
      </div>
      <div>
        <span>Cost to search</span>
        <strong>R0</strong>
      </div>
      <hr className="rule" />
      <p className="muted small">
        Every label on a listing says exactly what CarworX checked. Your
        location is used for this search only.
      </p>
    </aside>
  );
}
