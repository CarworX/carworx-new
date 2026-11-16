import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { openStatus } from "../catalogue/hours";
import CategoryPage from "./c.$category";
import ListingPage from "./p.$publicId";

/**
 * Render smoke tests: the Sites preview listing view (app.js `listing()`) and
 * the category page in the preview's search markup. Behaviour stays covered
 * by integration/pages.test.ts and integration/forms.test.ts.
 */
const ID = "de3c1000-0000-4000-8000-000000000001";
const listing = {
  public_id: ID,
  display_name: "Shine Studio",
  description: "Hand wash, valet and interior detailing while you wait.",
  metro: "Gauteng",
  mode: "fixed",
  public_address: "12 Kestrel Lane, Rosebank",
  service_name: "Wash & valet",
  category_slug: "wash-and-detailing",
  verification_labels: ["Identity checked"],
};

function renderListing(extra: Record<string, unknown> = {}) {
  const Page = ListingPage as unknown as (p: {
    loaderData: unknown;
    actionData?: unknown;
  }) => React.JSX.Element;
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <Page
          loaderData={{
            listing,
            hours: [{ day: 1, opens: "08:00", closes: "17:00" }],
            today: 1,
            status: openStatus([], new Date("2026-11-16T08:00:00Z")),
            csrf: "csrf-token-for-test",
            siteKey: null,
            sent: false,
            ...extra,
          }}
        />
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub />).replace(/&#x27;/g, "'");
}

describe("/p/:publicId: the preview listing view", () => {
  it("has the preview's title block, tags, cards and message side card", () => {
    const h = renderListing();
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).toContain('class="title"');
    expect(h).toContain('class="tag green"');
    expect(h).toContain("Workshop you visit");
    expect(h).toContain("12 Kestrel Lane, Rosebank · Gauteng");
    expect(h).toContain('id="hours"');
    expect(h).toContain('id="enquiry"');
    expect(h).toContain(`href="/provider/claim/${ID}"`);
    expect(h).toContain('href="/c/wash-and-detailing"');
    expect(h).toContain('href="/auth/sign-up"');
    expect(h).not.toMatch(/fictional|example listing|demo/i);
  });

  it("shows the enquiry form with its real fields when messages are on", () => {
    const h = renderListing({ siteKey: "1x00000000000000000000AA" });
    for (const name of ["name", "email", "message", "consent", "csrf"])
      expect(h).toMatch(new RegExp(`name="${name}`));
    expect(h).toContain('data-form="enquiry"');
  });

  it("a mobile provider shows no address", () => {
    const h = renderListing({
      listing: { ...listing, mode: "mobile", public_address: null },
    });
    expect(h).toContain("Comes to you");
    expect(h).not.toContain("Kestrel Lane");
  });

  it("says when a message was sent", () => {
    expect(renderListing({ sent: true })).toContain("Message sent.");
  });
});

describe("/c/:category in the preview's search markup", () => {
  const Page = CategoryPage as unknown as (p: {
    loaderData: unknown;
  }) => React.JSX.Element;
  const category = {
    key: "wash",
    slug: "wash-and-detailing",
    label: "Wash & Detailing",
    children: [],
  };
  const render = (d: Record<string, unknown>) =>
    renderToStaticMarkup(<Page loaderData={{ category, ...d }} />).replace(
      /&#x27;/g,
      "'",
    );

  it("marks the current service chip and lists cards without claiming coverage", () => {
    const h = render({ items: [listing], next: null, unavailable: false });
    expect(h).toMatch(/class="chip active" href="\/c\/wash-and-detailing"/);
    expect(h).toContain(`href="/p/${ID}"`);
    expect(h).toContain("1 listed");
    expect(h).toMatch(/<form[^>]*action="\/search"/);
    expect(h).not.toContain("serves your area");
  });

  it("keeps the unavailable note", () => {
    expect(render({ items: [], next: null, unavailable: true })).toContain(
      "Listings can't load right now.",
    );
  });
});
