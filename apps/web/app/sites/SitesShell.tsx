import { useState, type ReactNode } from "react";

import sitesCss from "./app.css?url";

/** The Sites app pages' stylesheet; add to each route's `links`. */
export const SITES_LINKS = [{ rel: "stylesheet", href: sitesCss }] as const;

const NAV = [
  { href: "/search", label: "Find a service" },
  { href: "/fines", label: "Fines & admin" },
  { href: "/provider/get-listed/business", label: "For businesses" },
] as const;

/**
 * The approved Sites preview's app shell (planning/sites-customer-preview/
 * dist/app.html on #83 @ b88a8ca), with real routes, Sign in / Sign up in
 * place of the demo links, and no hosting band.
 */
export function SitesShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sites">
      <header className="nav">
        <a href="/" aria-label="CarworX home">
          <img
            src="/assets/core/carworx-lockup-horizontal-ink.svg"
            alt="CarworX"
          />
        </a>
        <nav aria-label="Main navigation">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
          <a href="/auth/sign-in">Sign in</a>
          <a className="nav-pill" href="/auth/sign-up">
            Sign up
          </a>
        </nav>
        <button
          type="button"
          className="menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => {
            setOpen(!open);
          }}
        >
          ☰
        </button>
      </header>
      <nav
        id="mobile-nav"
        className="mobile-nav"
        hidden={!open}
        aria-label="Mobile navigation"
      >
        {NAV.map((n) => (
          <a key={n.href} href={n.href}>
            {n.label}
          </a>
        ))}
        <a href="/auth/sign-in">Sign in</a>
        <a href="/auth/sign-up">Sign up</a>
      </nav>
      <main id="app" tabIndex={-1}>
        <div className="shell">{children}</div>
      </main>
      <footer>
        <img
          src="/assets/core/carworx-lockup-horizontal-white.svg"
          alt="CarworX"
        />
        <p>Car care, booked properly.</p>
        <a href="/">Home</a> <a href="/fines">Fines guidance</a>{" "}
        <a href="/provider/get-listed/business">For businesses</a>{" "}
        <a href="/support">Contact support</a> <a href="/privacy">Privacy</a>{" "}
        <a href="/terms">Terms of use</a>
      </footer>
    </div>
  );
}
