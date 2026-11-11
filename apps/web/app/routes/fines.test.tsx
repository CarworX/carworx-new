import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Fines, { headers, OFFICIAL_LINKS } from "./fines";

const html = renderToStaticMarkup(<Fines />).replace(/&#x27;/g, "'");

describe("/fines (P2-6, A14)", () => {
  it("has no form and no field of any kind", () => {
    expect(html).not.toMatch(/<(?:form|input|select|textarea)\b/i);
  });

  it("never mentions collecting an ID number, except to say it doesn't", () => {
    const mentions = [...html.matchAll(/.{0,20}ID number/g)].map((m) => m[0]);
    expect(mentions.length).toBeGreaterThan(0);
    for (const m of mentions)
      expect(m).toMatch(/never ask for your ID number$/);
  });

  it("says that no results isn't the same as no fines", () => {
    expect(html).toContain("doesn't always mean you have none");
    expect(html).toContain(
      "One site showing nothing doesn't mean another has nothing for you.",
    );
  });

  it("links only to confirmed official https sites, each labelled and dated", () => {
    expect(OFFICIAL_LINKS.length).toBeGreaterThan(0);
    for (const link of OFFICIAL_LINKS) {
      expect(new URL(link.href).protocol).toBe("https:");
      expect(link.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(`opens ${new URL(link.href).hostname}`);
    }
    const external = [...html.matchAll(/href="(https?:[^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(
      external.every((h) => OFFICIAL_LINKS.some((l) => l.href === h)),
    ).toBe(true);
  });

  it("is a static, cacheable page", () => {
    expect(headers({} as never)).toEqual({
      "Cache-Control": "public, max-age=300",
    });
  });
});
