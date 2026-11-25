import type { ReactNode } from "react";

import sitesCss from "./app.css?url";
import { SiteFooter } from "../ui/site/SiteFooter";
import { SiteHeader } from "../ui/site/SiteHeader";

/** The Sites app pages' stylesheet; add to each route's `links`. */
export const SITES_LINKS = [{ rel: "stylesheet", href: sitesCss }] as const;

/**
 * The Sites app shell (redesign A1, C1): the shared site header and footer
 * around the app's content. Same header as every public page.
 */
export function SitesShell({ children }: { children: ReactNode }) {
  return (
    <div className="sites">
      <div className="cx-shell-top">
        <SiteHeader />
      </div>
      <main id="app" tabIndex={-1}>
        <div className="shell">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
