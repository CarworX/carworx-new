import { useMemo, useSyncExternalStore } from "react";
import { Link } from "react-router";

import type { PublicListing } from "../server/catalogue/public";
import { ListingCard } from "../sites/ListingCard";
import { SiteFooter } from "../ui/site/SiteFooter";
import { SiteHeader } from "../ui/site/SiteHeader";
import { SERVICES } from "../ui/services";
import {
  clearRecent,
  parseRecent,
  snapshotRecent,
  subscribeRecent,
} from "./recent";

/** Good morning / afternoon / evening, by South African time (UTC+2). */
export function greetingFor(now: Date): string {
  const sastHour = (now.getUTCHours() + 2) % 24;
  if (sastHour < 12) return "Good morning";
  if (sastHour < 17) return "Good afternoon";
  return "Good evening";
}

/** The service row: the four categories, then fines. */
const ROW = [
  { key: "wash", label: "Wash", to: "/c/wash-and-detailing" },
  { key: "repairs", label: "Repairs", to: "/c/repairs-and-maintenance" },
  { key: "glass", label: "Glass", to: "/c/glass-repair-and-replacement" },
  { key: "tyres", label: "Tyres", to: "/c/tyres-and-wheel-alignment" },
  { key: "fines", label: "Fines", to: "/fines" },
] as const;

/**
 * The signed-in customer home (redesign A4, C3). Only the root loader's
 * viewer and the public catalogue feed it. Fines show the "not verified" state:
 * the ID check is not live yet (B-21), so no fine count is shown here.
 */
export function CustomerHome({
  firstName,
  listings,
  now = new Date(),
}: {
  firstName: string | null;
  listings: PublicListing[];
  now?: Date;
}) {
  // Empty on the server (no localStorage there), read in the browser after hydration.
  const raw = useSyncExternalStore(subscribeRecent, snapshotRecent, () => null);
  const recent = useMemo(() => parseRecent(raw), [raw]);

  const nearby = listings.slice(0, 6);
  const mobile = listings.filter((l) => l.mode !== "fixed").slice(0, 6);
  const objectFor = (key: string) =>
    SERVICES.find((s) => s.key === key)?.object ?? "";

  return (
    <div className="cx-home cx-customer">
      <div className="cx-shell-top">
        <SiteHeader />
      </div>
      <main id="top" className="cx-cust">
        <section className="cx-cust-hero" aria-labelledby="cust-h">
          <h1 id="cust-h" suppressHydrationWarning>
            {firstName
              ? `${greetingFor(now)}, ${firstName}.`
              : `${greetingFor(now)}.`}
          </h1>
          <p className="cx-steel">What does your car need?</p>
          <form
            className="cx-cust-search"
            method="get"
            action="/search"
            role="search"
            aria-label="Find a car service"
          >
            <label className="sr-only" htmlFor="cust-q">
              Search washes, repairs, tyres or a business
            </label>
            <input
              id="cust-q"
              name="q"
              type="search"
              placeholder="Search washes, repairs, tyres or a business"
            />
            <button className="cx-btn" type="submit">
              Search
            </button>
          </form>
        </section>

        <nav className="cx-svcrow" aria-label="Services">
          {ROW.map((s) => (
            <Link key={s.key} to={s.to}>
              <span className="k">
                <img src={objectFor(s.key)} alt="" />
              </span>
              {s.label}
            </Link>
          ))}
        </nav>

        {nearby.length > 0 ? (
          <section aria-labelledby="row-nearby">
            <div className="cx-rowhead">
              <div>
                <h2 id="row-nearby">Browse businesses</h2>
                <small>Listed on CarworX, in every category</small>
              </div>
              <Link to="/c/wash-and-detailing">See all →</Link>
            </div>
            <div className="cx-rail">
              {nearby.map((l) => (
                <ListingCard key={l.public_id} listing={l} />
              ))}
            </div>
          </section>
        ) : null}

        <FinesCard />

        {mobile.length > 0 ? (
          <section aria-labelledby="row-mobile">
            <div className="cx-rowhead">
              <div>
                <h2 id="row-mobile">Comes to you</h2>
                <small>Mobile teams that work at your home or office</small>
              </div>
            </div>
            <div className="cx-rail">
              {mobile.map((l) => (
                <ListingCard key={l.public_id} listing={l} />
              ))}
            </div>
          </section>
        ) : null}

        {recent.length > 0 ? (
          <section aria-labelledby="row-recent">
            <div className="cx-rowhead">
              <div>
                <h2 id="row-recent">Recently viewed</h2>
                <small>Kept in this browser only</small>
              </div>
              <button
                type="button"
                className="cx-linkbtn"
                onClick={() => {
                  clearRecent();
                }}
              >
                Clear
              </button>
            </div>
            <div className="cx-rail">
              {recent.map((r) => (
                <Link key={r.id} className="cx-rcard" to={`/p/${r.id}`}>
                  <span className="cx-rcard-name">{r.name}</span>
                  <span className="cx-rcard-svc">{r.service}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}

function FinesCard() {
  return (
    <section className="cx-fcard" aria-labelledby="fines-h">
      <div>
        <h2 id="fines-h">Check your traffic fines</h2>
        <p>Confirm your ID once, then see and pay fines here.</p>
      </div>
      <Link className="cx-btn" to="/fines">
        Get started
      </Link>
    </section>
  );
}
