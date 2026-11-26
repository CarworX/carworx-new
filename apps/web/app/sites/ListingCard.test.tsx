import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ListingCard } from "./ListingCard";

const listing = {
  public_id: "d5520000-0000-4000-8000-000000000001",
  display_name: "Cover wash (synthetic)",
  metro: "Gauteng",
  mode: "fixed",
  service_name: "Wash",
  category_slug: "wash-and-detailing",
  verification_labels: [],
};

describe("search card cover photo (D-098)", () => {
  it("shows the cover when the listing has one", () => {
    const html = renderToStaticMarkup(
      <ListingCard
        listing={{
          ...listing,
          cover_key: "covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg",
        }}
      />,
    );
    expect(html).toContain(
      'src="/media/covers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg"',
    );
  });

  it("shows no image without one", () => {
    expect(
      renderToStaticMarkup(<ListingCard listing={listing} />),
    ).not.toContain("data-cover");
  });
});

it("shows New for an unrated listing and the average and count for a rated one", () => {
  expect(
    renderToStaticMarkup(
      <ListingCard
        listing={{ ...listing, rating_avg: null, rating_count: 0 }}
      />,
    ),
  ).toContain(">New<");
  expect(
    renderToStaticMarkup(
      <ListingCard
        listing={{ ...listing, rating_avg: 4.5, rating_count: 2 }}
      />,
    ),
  ).toContain("4.5 out of 5 · 2 reviews");
});

describe("where line (same rules as whereText)", () => {
  const mobile = { ...listing, mode: "mobile", metro: "Gauteng" };

  it("a mobile card shows the region and claims no coverage when browsing", () => {
    const html = renderToStaticMarkup(<ListingCard listing={mobile} />);
    expect(html).toContain('data-where="mobile"');
    expect(html).toContain("Comes to you</b> · Gauteng");
    expect(html).not.toContain("data-covers");
    expect(html).not.toContain("Covers your area");
  });

  it("claims coverage only for a result that passed a location search", () => {
    const html = renderToStaticMarkup(<ListingCard listing={mobile} matched />);
    expect(html).toContain("Comes to you</b> · Gauteng");
    expect(html).toContain("data-covers");
    expect(html).toContain("Covers your area");
  });

  it("a both-business found by its service area has no distance and names its premises", () => {
    const both = { ...listing, mode: "both", metro: "Synthetic Cape" };
    expect(renderToStaticMarkup(<ListingCard listing={both} />)).toContain(
      "Comes to you</b> · also has premises in Synthetic Cape",
    );
    const html = renderToStaticMarkup(<ListingCard listing={both} matched />);
    expect(html).toContain("data-covers");
    expect(html).toContain("also has premises in Synthetic Cape");
    expect(html).not.toContain(" km");
  });

  it("a both-business with a distance reads as a premises card", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={{ ...listing, mode: "both", distance_km: 3.8 }} />,
    );
    expect(html).toContain("Visit or comes to you");
    expect(html).toContain("3.8 km");
  });
});
