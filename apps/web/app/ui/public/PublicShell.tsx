import type { ReactNode } from "react";

import { ButtonLink, QuietLink } from "../Button";
import { NavBar } from "../NavBar";

const NAV = [
  { href: "/", label: "Find a service" },
  { href: "/fines", label: "Fines & admin" },
] as const;

/** The public page frame: Studio canvas, nav pill, one main landmark. */
export function PublicShell({
  current,
  children,
}: {
  current?: string;
  children: ReactNode;
}) {
  return (
    <div className="cx-canvas min-h-dvh">
      <div className="mx-auto max-w-[1180px] px-4 pt-4 pb-24 sm:px-6">
        <NavBar
          items={NAV}
          {...(current ? { current } : {})}
          action={<QuietLink href="/auth/sign-in">Sign in</QuietLink>}
          sheetActions={
            <ButtonLink href="/" block arrow>
              Find a service near you
            </ButtonLink>
          }
        />
        <main id="main" className="mt-10">
          {children}
        </main>
      </div>
    </div>
  );
}
