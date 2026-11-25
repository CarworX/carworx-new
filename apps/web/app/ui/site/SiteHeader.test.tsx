import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SiteDataContext } from "./useSiteViewer";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

const SIGNED_OUT = renderToStaticMarkup(<SiteHeader />);
const signedIn = (firstName: string | null) =>
  renderToStaticMarkup(
    <SiteDataContext
      value={{
        viewer: { firstName, initials: "TM" },
        csrf: "synthetic-csrf-token",
      }}
    >
      <SiteHeader />
    </SiteDataContext>,
  );

describe("the shared site header (C1)", () => {
  it("links to the three sections, from any page", () => {
    expect(SIGNED_OUT).toContain('href="/#services"');
    expect(SIGNED_OUT).toContain('href="/#fines"');
    expect(SIGNED_OUT).toContain('href="/#business"');
    expect(SIGNED_OUT).toContain("Find a service");
    expect(SIGNED_OUT).toContain("For businesses");
  });

  it("offers Sign in and Sign up when signed out", () => {
    expect(SIGNED_OUT).toContain('href="/auth/sign-in"');
    expect(SIGNED_OUT).toContain('href="/auth/sign-up"');
    expect(SIGNED_OUT).not.toContain("cx-avbtn");
    expect(SIGNED_OUT).not.toContain("Sign out");
  });

  it("shows the name and initials when signed in, and never an email", () => {
    const html = signedIn("Thandi");
    expect(html).toContain("Account menu for Thandi");
    expect(html).toContain(">TM<");
    expect(html).not.toContain('href="/auth/sign-in"');
    expect(html).toContain('action="/auth/sign-out"');
    expect(html).toContain('value="synthetic-csrf-token"');
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("says Account when no name is on file yet", () => {
    expect(signedIn(null)).toContain("Account menu for Account");
  });

  it("drops the mockup links and the retired copy", () => {
    expect(SIGNED_OUT).not.toContain("All services");
    expect(SIGNED_OUT).not.toContain("Cost to search");
    expect(SIGNED_OUT).not.toMatch(/\/search"[^>]*>Find a service/);
  });
});

describe("the shared site footer (C1)", () => {
  const html = renderToStaticMarkup(<SiteFooter />);
  it("has one set of links and the fine row", () => {
    expect(html).toContain("List your business");
    expect(html).toContain('href="/support"');
    expect(html).toContain("carworx.app · South Africa");
    expect(html).toContain('href="/terms"');
  });
  it("carries no pilot, demo or sandbox wording", () => {
    expect(html).not.toMatch(/pilot|demo|sandbox|R0|Synthetic/i);
  });
});
