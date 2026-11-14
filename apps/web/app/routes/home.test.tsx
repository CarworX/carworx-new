import { readFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home, { headers, links } from "./home";

const html = renderToStaticMarkup(<Home />);
const text = html.replace(/<[^>]+>/g, " ").toLowerCase();

describe("/ home: the Sites preview home, verbatim (owner, 14 Nov)", () => {
  it("is the preview's page: hero, timeline, quote, fines, app, business, closing", () => {
    for (const id of [
      'id="intro"',
      'class="hero"',
      'id="how"',
      'id="quote-sec"',
      'id="fines"',
      'id="glimpse"',
      'id="business"',
      'id="start"',
    ])
      expect(html).toContain(id);
    expect(html).toContain("Car care, booked properly.");
    expect(html).toContain("One booking, start to finish.");
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("has no hosting band and no demo, mock, concept or fictional wording", () => {
    for (const word of [
      "private interactive preview",
      "fictional",
      "demo",
      "mock",
      "concept",
      "prototype",
    ])
      expect(text).not.toContain(word);
  });

  it("links to real routes only", () => {
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    for (const href of hrefs)
      expect(href).toMatch(
        /^(#[a-z0-9-]+|\/(search|fines|support|privacy|terms|auth\/sign-in|auth\/sign-up|provider\/get-listed\/business|c\/[a-z-]+))$/,
      );
    for (const href of [
      "/c/wash-and-detailing",
      "/c/repairs-and-maintenance",
      "/c/glass-repair-and-replacement",
      "/c/tyres-and-wheel-alignment",
      "/fines",
      "/search",
    ])
      expect(hrefs).toContain(href);
  });

  it("puts Sign in and Sign up in the header and in the menu sheet", () => {
    const header = html.slice(
      html.indexOf('<header class="nav"'),
      html.indexOf("</header>"),
    );
    expect(header).toContain('href="/auth/sign-in"');
    expect(header).toContain('href="/auth/sign-up"');
    const sheet = html.slice(html.indexOf('id="menu"'));
    expect(sheet).toContain('class="acct-row"');
    expect(sheet).toContain('href="/auth/sign-up"');
  });

  it("loads its own stylesheet and script on this route only", () => {
    const list = links();
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list[0])).toContain('"rel":"stylesheet"');
    expect(html).toContain('<script src="/home/home.js" defer="">');
    const js = readFileSync(
      new URL("../../public/home/home.js", import.meta.url),
      "utf8",
    );
    expect(js).not.toMatch(/fetch\(|localStorage|document\.cookie/);
  });

  it("stays briefly cacheable (public, no personal data)", () => {
    expect(new Headers(headers({} as never)).get("Cache-Control")).toBe(
      "public, max-age=300",
    );
  });
});
