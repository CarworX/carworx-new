import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ListingResult, type ListingSummary } from "./ListingResult";

const base: ListingSummary = {
  public_id: "5ea03000-0000-4000-8000-000000000001",
  display_name: "Synthetic Both Wash",
  metro: "Synthetic Cape",
  mode: "both",
  service_name: "Car wash",
  category_slug: "washing-detailing",
  verification_labels: [],
};

describe("ListingResult for a both-business (O2)", () => {
  it("found through its service area: comes to you, also has premises, no distance", () => {
    const h = renderToStaticMarkup(<ListingResult listing={base} matched />);
    expect(h).toContain(
      "Comes to you · serves your area (approximate) · also has premises in Synthetic Cape",
    );
    expect(h).not.toMatch(/km/);
  });

  it("found by its premises: shows the straight-line distance", () => {
    const h = renderToStaticMarkup(
      <ListingResult listing={{ ...base, distance_km: 2.4 }} matched />,
    );
    expect(h).toContain("Synthetic Cape · 2.4 km straight-line");
  });

  it("in a browsing list: never claims coverage", () => {
    const h = renderToStaticMarkup(<ListingResult listing={base} />);
    expect(h).toContain("Comes to you · also has premises in Synthetic Cape");
    expect(h).not.toContain("serves your area");
  });
});
