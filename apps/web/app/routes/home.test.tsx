import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { pickCards, type HomeCatalogue } from "../server/catalogue/home";
import type { PublicListing } from "../server/catalogue/public";
import Home, { headers, links } from "./home";

const listing = (
  id: number,
  extra: Partial<PublicListing> = {},
): PublicListing => ({
  public_id: `de3c1000-0000-4000-8000-${String(id).padStart(12, "0")}`,
  display_name: `Business ${String(id)}`,
  description: "Synthetic",
  metro: "Gauteng",
  mode: "fixed",
  service_slug: "wash",
  service_name: "Wash & valet",
  category_slug: "wash-and-detailing",
  category_name: "Wash & Detailing",
  public_address: "1 Synthetic Road",
  public_latitude: null,
  public_longitude: null,
  verification_labels: [],
  ...extra,
});

const catalogue: HomeCatalogue = {
  counts: {
    "wash-and-detailing": 4,
    "repairs-and-maintenance": 3,
    "glass-repair-and-replacement": 2,
    "tyres-and-wheel-alignment": 1,
  },
  total: 14,
  listings: [
    listing(1, {
      display_name: "Shine Studio",
      verification_labels: ["Identity checked", "Premises visited"],
    }),
    listing(2, {
      display_name: "Cape Mobile Glass",
      mode: "mobile",
      public_address: null,
      category_slug: "glass-repair-and-replacement",
      verification_labels: ["Identity checked"],
    }),
  ],
};

function render(data: { catalogue: HomeCatalogue | null }) {
  const Page = Home as unknown as (p: {
    loaderData: unknown;
  }) => React.JSX.Element;
  const Stub = createRoutesStub([
    { path: "/", Component: () => <Page loaderData={data} /> },
  ]);
  return renderToStaticMarkup(<Stub />).replace(/&#x27;/g, "'");
}

const html = render({ catalogue });
const text = html.replace(/<[^>]+>/g, " ").toLowerCase();

describe("/ home: browse first (D-097)", () => {
  it("search comes first: name or service words, an area, no account needed", () => {
    const form = html.slice(html.indexOf('<form class="lp-search"'));
    const tag = form.slice(0, form.indexOf(">"));
    expect(tag).toContain('method="get"');
    expect(tag).toContain('action="/search"');
    expect(form).toContain('name="q"');
    expect(form).toContain('name="area"');
    expect(form).not.toMatch(/name="area"[^>]*required/);
    expect(html).toContain("What do you need?");
    expect(html).toContain("Free to browse");
    expect(html).toContain("Sign in only to book or send an enquiry");
    expect(html.indexOf('class="lp-search"')).toBeLessThan(
      html.indexOf("What does your car need?"),
    );
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("shows the five categories with live counts", () => {
    for (const [slug, words] of [
      ["wash-and-detailing", "4 businesses"],
      ["repairs-and-maintenance", "3 businesses"],
      ["glass-repair-and-replacement", "2 businesses"],
      ["tyres-and-wheel-alignment", "1 business"],
    ] as const) {
      const tile = new RegExp(`href="/c/${slug}".*?</a>`).exec(html)?.[0];
      expect(tile).toContain(words);
    }
    expect(html).toContain('href="/fines"');
  });

  it("lists live businesses without an account, with the sign-in hint", () => {
    expect(html).toContain("Businesses you can explore");
    expect(html).toContain("See all 14 →");
    expect(html).toContain(
      `href="/p/${catalogue.listings[0]?.public_id ?? ""}"`,
    );
    expect(html).toContain("Shine Studio");
    expect(html).toContain("Comes to you · Gauteng");
    expect(html).toContain("Enquire after sign in");
    // No location filter: never a coverage claim or a distance.
    expect(text).not.toContain("serves your area");
    expect(text).not.toContain("straight-line");
  });

  it("keeps the page when the catalogue can't be read", () => {
    const h = render({ catalogue: null });
    expect(h).toContain("Businesses can't load right now.");
    expect(h).toContain('class="lp-search"');
    expect(h).toContain("See businesses");
  });

  it("keeps the hero objects, intro, app glimpse and bands; drops the timeline and quote", () => {
    for (const keep of [
      'id="intro"',
      'class="floats"',
      'class="obj o-note"',
      'class="obj o-timer"',
      'id="glimpse"',
      'id="fines"',
      'id="business"',
      "Look first. Sign up when you're ready.",
    ])
      expect(html).toContain(keep);
    for (const gone of [
      'id="how"',
      'id="quote-sec"',
      'class="keys"',
      'id="start"',
    ])
      expect(html).not.toContain(gone);
  });

  it("has no demo, mock, concept or fictional wording", () => {
    for (const word of ["fictional", "demo", "mock", "concept", "prototype"])
      expect(text).not.toContain(word);
  });

  it("links to real routes only", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const href of hrefs)
      expect(href).toMatch(
        /^(#[a-z0-9-]+|\/(search(\?category=[a-z-]+)?|fines|support|privacy|terms|auth\/sign-in|auth\/sign-up|provider\/get-listed\/business|c\/[a-z-]+|p\/[0-9a-f-]{36}))$/,
      );
  });

  it("puts Sign in and Sign up in the header and in the menu sheet", () => {
    const header = html.slice(
      html.indexOf('<header class="nav"'),
      html.indexOf("</header>"),
    );
    expect(header).toContain('href="/auth/sign-in"');
    expect(header).toContain('href="/auth/sign-up"');
    const sheet = html.slice(html.indexOf('id="menu"'));
    expect(sheet).toContain('href="/auth/sign-up"');
  });

  it("loads its stylesheets and script on this route only", () => {
    expect(links()).toHaveLength(2);
    expect(html).toContain('<script src="/home/home.js" defer="">');
    const js = readFileSync(
      new URL("../../public/home/home.js", import.meta.url),
      "utf8",
    );
    expect(js).not.toMatch(/fetch\(|localStorage|document\.cookie/);
  });

  it("is briefly cacheable when the catalogue loaded, never when it failed", () => {
    const h = (v: string | null) =>
      new Headers(
        headers({
          loaderHeaders: new Headers(v ? { "Cache-Control": v } : {}),
        } as never),
      ).get("Cache-Control");
    expect(h("public, max-age=300")).toBe("public, max-age=300");
    expect(h("no-store")).toBe("no-store");
  });

  it("puts the most-checked businesses first", () => {
    const picked = pickCards([
      listing(3),
      listing(4, { verification_labels: ["a", "b"] }),
      listing(5, { verification_labels: ["a"] }),
    ]);
    expect(picked.map((l) => l.display_name)).toEqual([
      "Business 4",
      "Business 5",
      "Business 3",
    ]);
  });
});
