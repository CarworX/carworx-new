import type { ReactNode } from "react";
import { useMatches } from "react-router";

import { Lockup } from "../brand/Lockup";
import { ButtonLink, QuietLink } from "../Button";
import { NavBar } from "../NavBar";

/**
 * The approved Studio preview's navigation (#83, app.html): the driver's
 * two front doors, the business section, then one light pill on the right.
 */
const NAV = [
  { href: "/", label: "Find a service" },
  { href: "/fines", label: "Fines & admin" },
  { href: "/#business", label: "For businesses" },
] as const;

const GET_LISTED = "/provider/get-listed/business";

/** Signed-out visitors: Sign in and Sign up are always in reach. */
function AccountActions() {
  return (
    <>
      <QuietLink href="/auth/sign-in">Sign in</QuietLink>
      <ButtonLink href="/auth/sign-up" size="sm" arrow>
        Sign up
      </ButtonLink>
    </>
  );
}

function SheetActions({ signedOut = false }: { signedOut?: boolean }) {
  return (
    <>
      {signedOut ? (
        <div className="cx-sheet-acct">
          <ButtonLink href="/auth/sign-in" variant="secondary" block>
            Sign in
          </ButtonLink>
          <ButtonLink href="/auth/sign-up" block>
            Sign up
          </ButtonLink>
        </div>
      ) : null}
      <ButtonLink href="/" block arrow>
        Find a service near you
      </ButtonLink>
      <ButtonLink href={GET_LISTED} variant="secondary" block arrow>
        List your business
      </ButtonLink>
    </>
  );
}

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
      sheetActions={<SheetActions />}
    />
  );
}

/** The ink footer from the preview: white lockup, one line, three links. */
export function SiteFooter() {
  return (
    <footer className="cx-footer">
      <div className="in">
        <a className="logo" href="/">
          <Lockup title="CarworX home" />
        </a>
        <p className="tag">Car care you can check, near you.</p>
        <nav aria-label="Footer">
          <a href="/">Find a service</a>
          <a href="/fines">Fines guidance</a>
          <a href={GET_LISTED}>For businesses</a>
          <a href="/support">Contact support</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms of use</a>
        </nav>
        <p className="fine">carworx.app · South Africa</p>
      </div>
    </footer>
  );
}

/** The public page frame: Studio canvas, nav pill, one main landmark. */
export function PublicShell({
  current,
  signedIn = false,
  wide = false,
  children,
}: {
  current?: string;
  /** Signed-in pages link to the account instead of sign-in. */
  signedIn?: boolean;
  /** Home: sections set their own rhythm, so main has no top margin. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="cx-canvas flex min-h-dvh flex-col">
      <div className="cx-shell-top">
        {signedIn ? (
          <SignedInNavigation />
        ) : (
          <NavBar
            items={NAV}
            {...(current ? { current } : {})}
            action={<AccountActions />}
            sheetActions={<SheetActions signedOut />}
          />
        )}
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
