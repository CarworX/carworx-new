import { useState } from "react";
import { data } from "react-router";

import { CATEGORIES, topCategoryOf } from "../catalogue/taxonomy";
import homeCss from "../home/home.css?url";
import { INTRO_GATE } from "../home/introGate";
import landingCss from "../home/landing.css?url";
import markup from "../home/preview.html?raw";
import { homeCatalogue, type HomeCatalogue } from "../server/catalogue/home";
import type { PublicListing } from "../server/catalogue/public";
import { UseMyLocation } from "../sites/UseMyLocation";
import { SERVICES } from "../ui/services";
import type { Route } from "./+types/home";

/**
 * The browse-first home (D-097, planning/landing-redesign): search first,
 * categories with live counts, live businesses and a 3-step "look first"
 * row, all without an account. Kept verbatim from the Sites preview home
 * (app/home/preview.html): the header and menu sheet, the hero objects, the
 * first-visit intro, the app glimpse, the fines and business bands and the
 * footer. The timeline, the written-quote section, the service keys and the
 * closing band are gone (owner decision 4).
 */

function cut(start: string, end: string, from = 0): string {
  const a = markup.indexOf(start, from);
  const b = markup.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`home markup: ${start} not found`);
  return markup.slice(a, b);
}
function section(id: string): string {
  const at = markup.indexOf(`id="${id}"`);
  const start = markup.lastIndexOf("<section", at);
  const end = markup.indexOf("</section>", at) + "</section>".length;
  if (at < 0 || start < 0 || end < at) throw new Error(`home markup: ${id}`);
  return markup.slice(start, end);
}
/**
 * Icons, the preview intro, the header and the menu sheet. The header links
 * are the mockup's (the timeline they pointed to is gone).
 */
const HEAD = (() => {
  const head = markup.slice(0, markup.indexOf('<main id="top">'));
  const links = /<nav class="links" aria-label="Sections">[\s\S]*?<\/nav>/;
  const how = /href="#how"(\s*)>How it works/;
  if (!links.test(head) || !how.test(head))
    throw new Error("home markup: header links not found");
  return head
    .replace(
      links,
      '<nav class="links" aria-label="Main navigation"><a href="/search">Find a service</a><a href="/fines">Fines &amp; admin</a><a href="/provider/get-listed/business">For businesses</a></nav>',
    )
    .replace(how, 'href="/search"$1>Find a service');
})();
/** The hero's floating objects, as drawn in the preview. */
const FLOATS = cut('<div class="floats"', '<div class="hero-copy">');
// The business band's two switches were buttons with aria-selected and no
// role; as tabs they pass the accessibility audit (Lighthouse a11y >= 95).
const KEPT = ["glimpse", "fines", "business"]
  .map(section)
  .join("\n")
  .replace(
    '<div class="ptabs" id="dtabs">',
    '<div class="ptabs" id="dtabs" role="tablist" aria-label="Dashboard view">',
  )
  .replace(
    '<div class="ptabs" id="ctabs">',
    '<div class="ptabs" id="ctabs" role="tablist" aria-label="Chart range">',
  )
  .replace(
    /<button aria-selected="(true|false)" data-(p|r)=/g,
    '<button role="tab" aria-selected="$1" data-$2=',
  );
const FOOTER = markup.slice(markup.indexOf("</main>") + "</main>".length);

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: homeCss },
  { rel: "stylesheet", href: landingCss },
];

export const meta: Route.MetaFunction = () => [
  { title: "CarworX · Car care, booked properly" },
  {
    name: "description",
    content:
      "Washes, repairs, glass and tyres from businesses near you. Look around freely, no account needed. You pay the business directly.",
  },
];

export async function loader({ context }: Route.LoaderArgs) {
  const config = context.security.config;
  const catalogue: HomeCatalogue | null = config
    ? await homeCatalogue(config)
    : null;
  return data(
    { catalogue },
    {
      headers: {
        // Public catalogue data only, nothing personal: browsers may keep it
        // briefly. A failed read is not cached.
        "Cache-Control": catalogue ? "public, max-age=300" : "no-store",
      },
    },
  );
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => ({
  "Cache-Control": loaderHeaders.get("Cache-Control") ?? "public, max-age=300",
});

const plural = (n: number) =>
  n === 1 ? "1 business" : `${String(n)} businesses`;

function objectFor(categorySlug: string): string {
  const key = topCategoryOf(categorySlug)?.key ?? "repairs";
  return SERVICES.find((s) => s.key === key)?.object ?? "";
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const catalogue = loaderData.catalogue;
  return (
    <>
      {/* First-visit intro (owner, 14 Nov): runs before the page paints, once
          per browser, never with reduced motion; without JS nothing runs. */}
      <div
        id="cx-intro"
        aria-hidden="true"
        hidden
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />
      <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
      <script src="/intro/intro.js" async />
      <div className="cx-home cx-landing" suppressHydrationWarning>
        {/* Static, generated markup from the repository; no user input. */}
        <div
          className="lp-contents"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: HEAD }}
        />
        <main id="top">
          <section className="hero" aria-labelledby="h-hero" data-loop>
            <div
              className="lp-contents"
              suppressHydrationWarning
              dangerouslySetInnerHTML={{ __html: FLOATS }}
            />
            <div className="hero-copy">
              <span className="badge" data-hero>
                <i></i>Pilot · CarworX fee R0
              </span>
              <h1 id="h-hero">
                <span className="ln">
                  <span>Car care, booked properly.</span>
                </span>
                <span className="ln grey">
                  <span>Nearby, and in writing.</span>
                </span>
              </h1>
              <p className="sub" data-hero>
                <span className="lp-long">
                  Washes, repairs, glass and tyres from businesses near
                  you.{" "}
                </span>
                Look around freely. You pay the business directly.
              </p>
              <HeroSearch />
            </div>
          </section>
          <Categories catalogue={catalogue} />
          <Businesses catalogue={catalogue} />
          <HowItWorks />
          <div
            className="lp-contents"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: KEPT }}
          />
        </main>
        <div
          className="lp-contents"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: FOOTER }}
        />
      </div>
      <script src="/home/home.js" defer />
    </>
  );
}

function HeroSearch() {
  return (
    <div data-hero>
      <form
        className="lp-search"
        id="home-search"
        method="get"
        action="/search"
        role="search"
        aria-label="Find a car service"
      >
        <label className="lp-fld">
          <b>What do you need?</b>
          <input
            name="q"
            maxLength={60}
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Service or business name, e.g. “tyre fitment”"
          />
        </label>
        <label className="lp-fld lp-where">
          <b>Where?</b>
          <input
            name="area"
            maxLength={80}
            autoComplete="address-level2"
            placeholder="Suburb, town or postcode"
          />
        </label>
        <input type="hidden" name="lat" defaultValue="" />
        <input type="hidden" name="lng" defaultValue="" />
        <div className="lp-loc">
          <UseMyLocation formId="home-search" />
        </div>
        <button className="lp-go" type="submit">
          Search{" "}
          <span className="lp-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </form>
      <p className="lp-free">
        <span>
          <em>✓ Free to browse</em> · no account needed
        </span>
        <span>
          <span aria-hidden="true">🔒 </span>Sign in only to book or send an
          enquiry
        </span>
      </p>
    </div>
  );
}

function Categories({ catalogue }: { catalogue: HomeCatalogue | null }) {
  const fines = SERVICES.find((s) => s.key === "fines")?.object ?? "";
  return (
    <section className="lp-sec" aria-labelledby="h-cats">
      <div className="wrap">
        <div className="lp-head">
          <div>
            <span className="lp-eyebrow">Browse by category</span>
            <h2 id="h-cats">What does your car need?</h2>
          </div>
          <a href="/search">All services →</a>
        </div>
        <ul className="lp-cats">
          {CATEGORIES.map((c, i) => (
            <li key={c.slug}>
              <a className="lp-cat" href={`/c/${c.slug}`}>
                <small>{String(i + 1).padStart(2, "0")}</small>
                <img src={objectFor(c.slug)} alt="" width={46} height={46} />
                <h3>{c.label}</h3>
                <p>
                  {catalogue
                    ? plural(catalogue.counts[c.slug] ?? 0)
                    : "See businesses"}
                </p>
              </a>
            </li>
          ))}
          <li>
            <a className="lp-cat" href="/fines">
              <small>05</small>
              <img src={fines} alt="" width={46} height={46} />
              <h3>Fines &amp; Vehicle Admin</h3>
              <p>Guides, free</p>
            </a>
          </li>
        </ul>
      </div>
    </section>
  );
}

type Filter = "all" | "wash" | "repairs" | "glass" | "tyres" | "mobile";
const FILTERS: { key: Filter; label: string; href: string }[] = [
  { key: "all", label: "All", href: "/search" },
  ...CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label.split(" ")[0] ?? c.label,
    href: `/search?category=${c.slug}`,
  })),
  { key: "mobile", label: "Comes to you", href: "/search" },
];

function matches(l: PublicListing, f: Filter) {
  if (f === "all") return true;
  if (f === "mobile") return l.mode !== "fixed";
  return topCategoryOf(l.category_slug)?.key === f;
}

function Businesses({ catalogue }: { catalogue: HomeCatalogue | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const shown = (catalogue?.listings ?? []).filter((l) => matches(l, filter));
  return (
    <section className="lp-sec" aria-labelledby="h-biz-list">
      <div className="wrap">
        <div className="lp-head">
          <div>
            <span className="lp-eyebrow">On CarworX now</span>
            <h2 id="h-biz-list">Businesses you can explore</h2>
          </div>
          <a href="/search">
            {catalogue ? `See all ${String(catalogue.total)} →` : "See all →"}
          </a>
        </div>
        <nav className="lp-chips" aria-label="Filter businesses">
          {FILTERS.map((f) => (
            <a
              key={f.key}
              href={f.href}
              className={filter === f.key ? "lp-chip on" : "lp-chip"}
              aria-current={filter === f.key ? "true" : undefined}
              onClick={(event) => {
                // With JavaScript, filter the cards shown here. When none of
                // them matches, the link goes to that search instead, so a
                // category with businesses is never shown as empty.
                const sample = catalogue?.listings ?? [];
                if (!sample.some((l) => matches(l, f.key))) return;
                event.preventDefault();
                setFilter(f.key);
              }}
            >
              {f.label}
            </a>
          ))}
        </nav>
        {catalogue === null ? (
          <p className="lp-note" role="status">
            Businesses can't load right now.{" "}
            <a href="/search">Search instead →</a>
          </p>
        ) : shown.length === 0 ? (
          <p className="lp-note" role="status">
            <a href="/search">See every business →</a>
          </p>
        ) : (
          <>
            <div className="lp-grid">
              {shown.map((l) => (
                <BusinessCard key={l.public_id} listing={l} />
              ))}
            </div>
            {filter !== "all" ? (
              <p className="lp-note">
                <a
                  href={
                    FILTERS.find((f) => f.key === filter)?.href ?? "/search"
                  }
                >
                  See all of them →
                </a>
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function BusinessCard({ listing: l }: { listing: PublicListing }) {
  const where = l.mode === "mobile" ? `Comes to you · ${l.metro}` : l.metro;
  return (
    <article className="lp-card">
      {l.cover_key ? (
        <img
          className="lp-cover"
          src={`/media/${l.cover_key}`}
          alt=""
          loading="lazy"
          data-cover
        />
      ) : null}
      <div className="lp-top">
        <img src={objectFor(l.category_slug)} alt="" width={44} height={44} />
        <div>
          <h3>{l.display_name}</h3>
          <p className="lp-where">{where}</p>
        </div>
      </div>
      {l.verification_labels.length > 0 || l.mode !== "fixed" ? (
        <div className="lp-tags">
          {l.verification_labels.map((label) => (
            <span key={label} className="lp-tag">
              {label}
            </span>
          ))}
          {l.mode !== "fixed" ? (
            <span className="lp-tag grey">Mobile</span>
          ) : null}
        </div>
      ) : null}
      <div className="lp-svc">
        <div>
          {l.service_name}
          <span>{l.mode === "fixed" ? "Workshop" : "Comes to you"}</span>
        </div>
        <div>
          {topCategoryOf(l.category_slug)?.label ?? l.category_name}
          <span>Free to enquire</span>
        </div>
      </div>
      <div className="lp-acts">
        <a className="lp-btn" href={`/p/${l.public_id}`}>
          View business →
        </a>
        <span className="lp-lock">
          <span aria-hidden="true">🔒 </span>Enquire after sign in
        </span>
      </div>
    </article>
  );
}

function HowItWorks() {
  return (
    <section className="lp-sec" aria-labelledby="h-look">
      <div className="wrap">
        <div className="lp-head">
          <div>
            <span className="lp-eyebrow">How it works</span>
            <h2 id="h-look">Look first. Sign up when you're ready.</h2>
          </div>
        </div>
        <ol className="lp-how">
          <li>
            <span className="lp-n">01</span>
            <h3>Explore</h3>
            <p>Search, compare businesses, services, hours and checks.</p>
            <span className="lp-badge open">No account needed</span>
          </li>
          <li>
            <span className="lp-n">02</span>
            <h3>Create a free account</h3>
            <p>
              Takes under a minute. We keep your search and the business you
              picked.
            </p>
            <span className="lp-badge">When you're ready</span>
          </li>
          <li>
            <span className="lp-n">03</span>
            <h3>Book or enquire</h3>
            <p>
              Accepted within 2 business hours. Paid to the business directly.
            </p>
            <span className="lp-badge">Signed in</span>
          </li>
        </ol>
      </div>
    </section>
  );
}
