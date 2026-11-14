import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home, { headers } from "./home";

const html = renderToStaticMarkup(<Home />).replace(/&#x27;/g, "'");

describe("/ home (redesign group 1: the approved Studio preview)", () => {
  it("renders one h1 and the preview's section headings", () => {
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    for (const id of ["h-hero", "h-how", "h-fines", "h-biz", "h-close"])
      expect(html).toContain(`id="${id}"`);
  });

  it("keeps the no-JavaScript GET search form and the five service keys", () => {
    expect(html).toMatch(/<form[^>]*action="\/search"/);
    expect(html).toMatch(/<form[^>]*method="get"/);
    for (const href of [
      "/c/wash-and-detailing",
      "/c/repairs-and-maintenance",
      "/c/glass-repair-and-replacement",
      "/c/tyres-and-wheel-alignment",
      "/fines",
    ])
      expect(html).toContain(`href="${href}"`);
  });

  it("has the shared header and ink footer, with the business entry", () => {
    expect(html).toContain('href="/auth/sign-in"');
    expect(html).toContain('href="/provider/get-listed/business"');
    expect(html).toContain('class="cx-footer"');
    for (const href of ["/support", "/privacy", "/terms"])
      expect(html).toContain(`href="${href}"`);
  });

  it("promises nothing the directory launch does not do (D-093)", () => {
    expect(html).not.toMatch(/book(ed|ing)|paid|payment|quote/i);
  });

  it("keeps decoration out of the accessibility tree", () => {
    expect(html).toMatch(/class="cx-floats" aria-hidden="true"/);
  });

  it("stays briefly cacheable (public, no personal data)", () => {
    expect(new Headers(headers({} as never)).get("Cache-Control")).toBe(
      "public, max-age=300",
    );
  });
});
