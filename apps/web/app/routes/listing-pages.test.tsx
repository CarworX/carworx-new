import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { openStatus } from "../catalogue/hours";
import CategoryPage from "./c.$category";
import ListingPage from "./p.$publicId";

/**
 * Render smoke tests for redesign group 3 (the preview's listing and
 * category layouts). Behaviour stays covered by integration/pages.test.ts.
 */
const ID = "de3c1000-0000-4000-8000-000000000001";
const listing = {
  public_id: ID,
  display_name: "Shine Studio (DEMO)",
  description: "DEMO listing: a fictional business for staging.",
  metro: "Gauteng",
  mode: "fixed",
  public_address: "12 Demo Lane, Rosebank",
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

describe("/p/:publicId layout", () => {
  it("has the preview head, tag bar, cards and the message side card", () => {
    const h = renderListing();
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).toContain("Shine Studio (DEMO)");
    expect(h).toContain('class="cx-tagbar"');
    expect(h).toContain("Workshop you visit");
    expect(h).toContain("12 Demo Lane, Rosebank · Gauteng");
    expect(h).toContain("What CarworX checked");
    expect(h).toContain('id="enquiry"');
    expect(h).toContain(`href="/provider/claim/${ID}"`);
    expect(h).toContain('href="/c/wash-and-detailing"');
  });

  it("a mobile provider shows no address", () => {
    const h = renderListing({
      listing: { ...listing, mode: "mobile", public_address: null },
    });
    expect(h).toContain("Comes to you");
    expect(h).not.toContain("Demo Lane");
  });

  it("says when a message was sent", () => {
    expect(renderListing({ sent: true })).toContain("Message sent.");
  });
});

describe("/c/:category layout", () => {
  const Page = CategoryPage as unknown as (p: {
    loaderData: unknown;
  }) => React.JSX.Element;
  const category = {
    key: "wash",
    slug: "wash-and-detailing",
    label: "Wash & Detailing",
    children: [],
  };

  it("shows service pills with the current one marked, and the cards", () => {
    const h = renderToStaticMarkup(
      <Page
        loaderData={{
          category,
          items: [listing],
          next: null,
          unavailable: false,
        }}
      />,
    );
    expect(h).toMatch(/href="\/c\/wash-and-detailing" aria-current="page"/);
    expect(h).toContain(`href="/p/${ID}"`);
    expect(h).toContain("1 shown");
    expect(h).not.toContain("serves your area");
  });

  it("keeps the unavailable note", () => {
    const h = renderToStaticMarkup(
      <Page
        loaderData={{ category, items: [], next: null, unavailable: true }}
      />,
    ).replace(/&#x27;/g, "'");
    expect(h).toContain("Listings can't load right now.");
  });
});
