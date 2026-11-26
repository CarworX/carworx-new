import { useState } from "react";
import { data } from "react-router";

import { CATEGORIES, topCategoryOf } from "../catalogue/taxonomy";
import homeCss from "../home/home.css?url";
import { INTRO_GATE } from "../home/introGate";
import landingCss from "../home/landing.css?url";
import markup from "../home/preview.html?raw";
import { CustomerHome } from "../home/CustomerHome";
import { homeCatalogue, type HomeCatalogue } from "../server/catalogue/home";
import type { PublicListing } from "../server/catalogue/public";
import { readViewer } from "../ui/site/viewer.server";
import { throwRedirect } from "../auth/http.server";
import {
  readTermsStateForRequest,
  TERMS_PATH,
} from "../auth/terms-gate.server";
import { SiteFooter } from "../ui/site/SiteFooter";
import { SiteHeader } from "../ui/site/SiteHeader";
import { UseMyLocation } from "../sites/UseMyLocation";
import { LocationPicker } from "../sites/LocationPicker";
import { SERVICES } from "../ui/services";
import { ListingCard } from "../sites/ListingCard";
import coverCss from "../sites/cover.css?url";
import panelCss from "../home/for-businesses.css?url";
import panelHtml from "../home/for-businesses-panel.html?raw";
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
/**
 * Icons, the preview intro, the header and the menu sheet. The header links
 * are the mockup's (the timeline they pointed to is gone).
 */
const HEAD = (() => {
  // Icon sprite only: the mockup intro (B-01/B-09) and the mockup header are
  // gone; the shared SiteHeader replaces the header (redesign A1).
  const head = markup.slice(0, markup.indexOf('<header class="nav">'));
  return head.replace(/<div id="intro"[\s\S]*$/, "");
})();
/** The hero's floating objects, as drawn in the preview. */
const FLOATS = cut('<div class="floats"', '<div class="hero-copy">');
export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: homeCss },
  { rel: "stylesheet", href: landingCss },
  { rel: "stylesheet", href: coverCss },
  { rel: "stylesheet", href: panelCss },
];

export const meta: Route.MetaFunction = () => [
  { title: "CarworX · Car care, booked properly" },
  {
    name: "description",
    content:
      "Washes, repairs, glass and tyres from businesses near you. Look around freely, no account needed. You pay the business directly.",
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const config = context.security.config;
  const catalogue: HomeCatalogue | null = config
    ? await homeCatalogue(config)
    : null;
  // Signed in, the page carries the visitor's first name: never shared-cached.
  const viewer = await readViewer(request, config).catch(() => null);
  // Signed in with pending account terms: the consent page comes first (B-10 2b).
  if (
    viewer !== null &&
    (await readTermsStateForRequest(request, config)) === "pending"
  )
    throwRedirect(`${TERMS_PATH}?returnTo=%2F`);
  return data(
    { catalogue, viewer },
    {
      headers: {
        // Public catalogue data only, nothing personal: browsers may keep it
        // briefly. A failed read is not cached.
        "Cache-Control": viewer
          ? "private, no-store"
          : catalogue
            ? "public, max-age=300"
            : "no-store",
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
  // Signed in, the customer home replaces the landing (redesign A4, C3).
  if (loaderData.viewer) {
    return (
      <CustomerHome
        firstName={loaderData.viewer.firstName}
        listings={catalogue?.listings ?? []}
      />
    );
  }
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
        <div className="cx-shell-top">
          <SiteHeader />
        </div>
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
                <i></i>Free to browse · Free to list
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
          <FinesBand />
          <ForBusinesses />
        </main>
        <SiteFooter />
      </div>
      <script src="/home/home.js" defer />
    </>
  );
}

function HeroSearch() {
  // The location message gets its own row under the bar (B-05); it never
  // sits inside .lp-loc, so a long sentence can't squeeze the search bar.
  const [locError, setLocError] = useState<string | null>(null);
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
        <div className="lp-fld lp-where">
          <label htmlFor="home-location">
            <b>Where?</b>
          </label>
          <LocationPicker id="home-location" />
        </div>
        <input type="hidden" name="lat" defaultValue="" />
        <input type="hidden" name="lng" defaultValue="" />
        <input type="hidden" name="near" defaultValue="" />
        <div className="lp-loc">
          <UseMyLocation formId="home-search" onError={setLocError} />
        </div>
        <button className="lp-go" type="submit">
          Search{" "}
          <span className="lp-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </form>
      {locError ? (
        <p className="lp-loc-msg" role="alert">
          {locError}
        </p>
      ) : null}
      <p className="lp-free">
        <span>
          <em>✓ Free to browse</em> · no account needed
        </span>
        <span>
          <span aria-hidden="true">🔒 </span>Sign in only to send an enquiry
        </span>
      </p>
    </div>
  );
}

function Categories({ catalogue }: { catalogue: HomeCatalogue | null }) {
  const fines = SERVICES.find((s) => s.key === "fines")?.object ?? "";
  return (
    <section className="lp-sec" id="services" aria-labelledby="h-cats">
      <div className="wrap">
        <div className="lp-head">
          <div>
            <span className="lp-eyebrow">Find a service</span>
            <h2 id="h-cats">What does your car need?</h2>
          </div>
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
            <a className="lp-cat" href="#fines">
              <small>05</small>
              <img src={fines} alt="" width={46} height={46} />
              <h3>Fines &amp; Vehicle Admin</h3>
              <p>Check and pay fines</p>
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
            <div className="cx-lgrid">
              {shown.map((l) => (
                <ListingCard key={l.public_id} listing={l} />
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
            <h3>Send an enquiry</h3>
            <p>The business replies to you directly. You pay them directly.</p>
            <span className="lp-badge">Signed in</span>
          </li>
        </ol>
      </div>
    </section>
  );
}

/**
 * Fines (redesign A2, C4). Signed-out only: a signed-in visitor gets the
 * customer home instead (see the loader's viewer), so this band never shows
 * a fine count.
 */
function FinesBand() {
  const fines = SERVICES.find((s) => s.key === "fines")?.object ?? "";
  return (
    <section className="lp-sec" id="fines" aria-labelledby="h-fines">
      <div className="wrap">
        <div className="lp-head">
          <div>
            <span className="lp-eyebrow">Fines &amp; Vehicle Admin</span>
            <h2 className="h2" id="h-fines">
              <span className="ln">
                <span>A fine on the windscreen?</span>
              </span>
              <span className="ln grey">
                <span>Check it and pay it here.</span>
              </span>
            </h2>
          </div>
          <img src={fines} alt="" width={72} height={72} />
        </div>
        <p className="lede">
          See the traffic fines linked to your ID number and pay them in one
          place, with a receipt you can keep.
        </p>
        <ol className="lp-how">
          <li>
            <span className="lp-n">1</span>
            <h3>Confirm it&rsquo;s you, once</h3>
            <p>
              Photograph your ID and take a quick selfie on our verification
              partner&rsquo;s secure screen. Usually done in under a minute.
            </p>
          </li>
          <li>
            <span className="lp-n">2</span>
            <h3>See every fine on your ID</h3>
            <p>
              Amount, issuer, due date and any discount, in plain words. No more
              hunting across municipal sites.
            </p>
          </li>
          <li>
            <span className="lp-n">3</span>
            <h3>Pay securely, get a receipt</h3>
            <p>
              You pay on our payment partner&rsquo;s secure checkout. We show
              &ldquo;Paid&rdquo; only once the issuer confirms it.
            </p>
          </li>
        </ol>
        <div className="biz-cta">
          <a className="pill" href="/auth/sign-in?returnTo=%2Ffines">
            <span>Sign in to see your fines</span>
          </a>
          <small>Free to check. You pay only the fine.</small>
        </div>
      </div>
    </section>
  );
}

/**
 * For businesses (redesign A2, C4): the free-to-list copy and the static
 * dashboard panel (rd- rules in for-businesses.css). No fee wording.
 */
function ForBusinesses() {
  const wash = SERVICES.find((s) => s.key === "wash")?.object ?? "";
  return (
    <section className="lp-sec" id="business" aria-labelledby="h-biz">
      <div className="wrap">
        <div className="biz-head">
          <div>
            <span className="lp-eyebrow">For businesses</span>
            <h2 className="h2" id="h-biz">
              <span className="ln">
                <span>Free to list.</span>
              </span>
              <span className="ln grey">
                <span>Paid directly.</span>
              </span>
            </h2>
            <p className="lede">
              Washes, workshops, glass fitters, tyre shops and mobile teams.
              Customers find you and send enquiries, and every payment goes
              straight to you.
            </p>
          </div>
          <ul className="perks">
            <li>Free to list</li>
            <li>Checked by our team</li>
            <li>Enquiries to your inbox</li>
            <li>Add your team</li>
          </ul>
        </div>
        {/* Static, generated markup from the repository; no user input. */}
        <div
          dangerouslySetInnerHTML={{
            __html: panelHtml.replace("__WASH_OBJECT__", wash),
          }}
        />
        <div className="biz-cta">
          <a className="pill" href="/provider/get-listed/business">
            <span>List your business free</span>
          </a>
          <small>
            Free to list. Our team checks every business before it goes live.
          </small>
        </div>
      </div>
    </section>
  );
}
