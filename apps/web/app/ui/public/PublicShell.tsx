import type { ReactNode } from "react";
import { useMatches } from "react-router";

import { ButtonLink, QuietLink } from "../Button";
import { NavBar } from "../NavBar";

const NAV = [
  { href: "/", label: "Find a service" },
  { href: "/fines", label: "Fines & admin" },
] as const;

function SignedInNavigation() {
  const matches = useMatches();
  let csrf: string | undefined;
  for (const match of matches) {
    const value: unknown = match.loaderData;
    if (
      typeof value === "object" &&
      value !== null &&
      "csrf" in value &&
      typeof value.csrf === "string"
    ) {
      csrf = value.csrf;
    }
  }
  return (
    <NavBar
      items={NAV}
      {...(csrf
        ? {
            account: {
              name: "Your account",
              sub: "CarworX",
              initials: "CX",
              csrf,
              links: [
                { href: "/account/profile", label: "Profile and settings" },
                { href: "/account/security", label: "Security" },
              ],
            },
          }
        : { action: <QuietLink href="/account">Account</QuietLink> })}
      sheetActions={
        <ButtonLink href="/" block arrow>
          Find a service near you
        </ButtonLink>
      }
    />
  );
}

/** The public page frame: Studio canvas, nav pill, one main landmark. */
export function PublicShell({
  current,
  signedIn = false,
  children,
}: {
  current?: string;
  /** Signed-in pages link to the account instead of sign-in. */
  signedIn?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="cx-canvas min-h-dvh">
      <div className="mx-auto max-w-[1180px] px-4 pt-4 pb-24 sm:px-6">
        {signedIn ? (
          <SignedInNavigation />
        ) : (
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
        )}
        <main id="main" className="mt-10">
          {children}
        </main>
        <footer className="type-caption text-quiet mt-16 flex flex-wrap gap-x-5 gap-y-2">
          <a href="/support">Contact support</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms of use</a>
        </footer>
      </div>
    </div>
  );
}
