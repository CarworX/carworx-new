import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PageModel } from "../server/search/page";
import SearchPage from "./search";

function render(m: PageModel) {
  const Page = SearchPage as unknown as (p: {
    loaderData: PageModel;
  }) => React.JSX.Element;
  return renderToStaticMarkup(<Page loaderData={m} />).replace(/&#x27;/g, "'");
}

const results: PageModel = {
  kind: "results",
  lat: "-26.146",
  lng: "28.041",
  near: "Rosebank",
  category: "",
  radius: 25,
  body: {
    fixed: {
      items: [
        {
          public_id: "de3c1000-0000-4000-8000-000000000001",
          display_name: "Shine Studio (DEMO)",
          metro: "Gauteng",
          service_name: "Wash & valet",
          category_slug: "wash-and-detailing",
          verification_labels: ["Identity checked"],
          distance_km: 0.4,
          public_latitude: -26.146,
          public_longitude: 28.041,
        },
      ],
      next: null,
    },
    mobile: { items: [], next: null },
  } as never,
  radiusLinks: [5, 10, 25, 50].map((r) => ({
    radius: r,
    href: `/search?radius=${String(r)}`,
    current: r === 25,
  })),
  categoryLinks: [
    { slug: "", label: "All services", href: "/search?x", current: true },
    {
      slug: "wash-and-detailing",
      label: "Wash & Detailing",
      href: "/search?y",
      current: false,
    },
  ],
  moreFixed: null,
  moreMobile: null,
  showMap: null,
  mapImage: null,
};

describe("/search page (redesign group 2)", () => {
  it("start state: preview head, GET form, service pills and the side card", () => {
    const h = render({ kind: "start", category: "", radius: 25 });
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    expect(h).toContain("Find a car service");
    expect(h).toMatch(/<form[^>]*action="\/search"/);
    expect(h).toContain('href="/c/wash-and-detailing"');
    expect(h).toContain('class="cx-aside"');
  });

  it("results: the card's name is its one link, with labels and distance", () => {
    const h = render(results);
    expect(h).toContain("All services near Rosebank");
    expect(
      h.match(/href="\/p\/de3c1000-0000-4000-8000-000000000001"/g),
    ).toHaveLength(1);
    expect(h).toContain("Identity checked");
    expect(h).toContain("Gauteng · 0.4 km straight-line");
    expect(h).toContain('aria-current="page"');
    expect(h).toContain("1 shown");
  });

  it("results with nothing found keep the demand route", () => {
    const h = render({
      ...results,
      body: {
        fixed: { items: [], next: null },
        mobile: { items: [], next: null },
      } as never,
    });
    expect(h).toContain('href="/demand?category="');
  });
});
