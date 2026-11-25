import type { ReactNode } from "react";

import { SiteFooter } from "../site/SiteFooter";
import { SiteHeader } from "../site/SiteHeader";

/**
 * The public page frame (redesign A1): the shared site header and footer, one
 * main landmark. The header reads the signed-in person from the root loader, so
 * `signedIn` and `current` are no longer needed; they stay in the type so
 * existing callers still compile.
 */
export function PublicShell({
  wide = false,
  children,
}: {
  current?: string;
  signedIn?: boolean;
  /** Home: sections set their own rhythm, so main has no top margin. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="cx-canvas flex min-h-dvh flex-col">
      <div className="cx-shell-top">
        <SiteHeader />
      </div>
      <main
        id="main"
        className={`mx-auto w-full max-w-[1180px] flex-1 px-4 pb-24 sm:px-6 ${wide ? "" : "mt-10"}`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
