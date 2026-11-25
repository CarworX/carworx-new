import { ButtonLink, QuietLink } from "../Button";
import { NavBar, type AccountInfo } from "../NavBar";
import { useSiteViewer } from "./useSiteViewer";

/**
 * The site header on every public page and the auth pages (redesign A1,
 * B-02/B-03/B-04). It knows the signed-in person from the root loader, so the
 * same header is right everywhere. Links are hash links into the landing page,
 * so from any page they go home and to the section.
 */
export const SITE_NAV = [
  { href: "/#services", label: "Find a service" },
  { href: "/#fines", label: "Fines" },
  { href: "/#business", label: "For businesses" },
] as const;

export const GET_LISTED = "/provider/get-listed/business";

function SignedOutActions() {
  return (
    <>
      <QuietLink href="/auth/sign-in">Sign in</QuietLink>
      <ButtonLink href="/auth/sign-up" size="sm" arrow>
        Sign up
      </ButtonLink>
    </>
  );
}

function SignedOutSheet() {
  return (
    <>
      <div className="cx-sheet-acct">
        <ButtonLink href="/auth/sign-in" variant="secondary" block>
          Sign in
        </ButtonLink>
        <ButtonLink href="/auth/sign-up" block>
          Sign up
        </ButtonLink>
      </div>
      <ButtonLink href={GET_LISTED} variant="secondary" block arrow>
        List your business
      </ButtonLink>
    </>
  );
}

export function SiteHeader() {
  const { viewer, csrf } = useSiteViewer();
  if (viewer === null) {
    return (
      <NavBar
        items={SITE_NAV}
        action={<SignedOutActions />}
        sheetActions={<SignedOutSheet />}
      />
    );
  }
  // Name only: never the full email (C1 rule). The menu shows the first name,
  // or "Account" when no name is on file yet.
  const account: AccountInfo = {
    name: viewer.firstName ?? "Account",
    sub: "Your CarworX account",
    initials: viewer.initials,
    csrf,
    links: [
      { href: "/fines/mine", label: "My fines" },
      { href: "/account", label: "Account" },
      { href: "/provider", label: "My business" },
    ],
  };
  // The account section (links and sign-out) comes from NavBar itself, in the
  // menu and in the sheet, so nothing is listed twice.
  return <NavBar items={SITE_NAV} account={account} />;
}
