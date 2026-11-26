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
