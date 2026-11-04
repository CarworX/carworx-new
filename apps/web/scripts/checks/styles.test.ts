// Static checks on the Studio stylesheets: the audit findings T4 must not
// regress (G1/D-066, G12, focus, targets, reduced motion, no remote URL).
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = (f: string) =>
  readFileSync(new URL(`../../app/styles/${f}`, import.meta.url), "utf8");
const studio = css("studio.css");
const states = css("states.css");
const app = css("app.css");

/** The declarations of the first rule whose selector list is exactly `sel`. */
function rule(source: string, sel: string): string {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(source);
  if (!m?.[1]) throw new Error(`rule not found: ${sel}`);
  return m[1];
}

describe("D-066 / G1 control edges", () => {
  it.each([
    ".cx-chip",
    ".cx-slot",
    ".cx-btn.outline",
    ".cx-input",
    ".cx-box",
    ".cx-seg",
  ])("%s is edged in --control-edge", (sel) => {
    const r = rule(studio, sel);
    expect(r).toMatch(/inset 0 0 0 1(?:\.5)?px var\(--control-edge\)/);
    expect(r).not.toContain("var(--line)");
  });
  it("never uses --line for an interactive edge", () => {
    for (const sel of [
      ".cx-chip",
      ".cx-slot",
      ".cx-btn.outline",
      ".cx-input",
      ".cx-box",
      ".cx-seg",
    ])
      expect(rule(studio, sel)).not.toContain("--line");
  });
});

describe("G12 StepList number", () => {
  it("positions the number only, not every span", () => {
    expect(rule(studio, ".cx-steps .k .n")).toContain("position: absolute");
    expect(studio).not.toMatch(/\.cx-steps \.k span\s*\{/);
  });
});

describe("focus and targets", () => {
  it("draws a 2 px ink outline with a 2 px offset on every focusable element", () => {
    const r = rule(app, ":focus-visible");
    expect(r).toContain("outline: 2px solid var(--ink)");
    expect(r).toContain("outline-offset: 2px");
  });
  it("custom controls forward the same ring from their hidden input", () => {
    for (const sel of [
      ".cx-slot:has(input:focus-visible)",
      ".cx-seg > label:has(input:focus-visible)",
      ".cx-check:has(input:focus-visible) .cx-box",
      ".cx-search:focus-within",
    ]) {
      const r = rule(studio, sel);
      expect(r, sel).toContain("outline: 2px solid var(--ink)");
      expect(r, sel).toContain("outline-offset: 2px");
    }
  });
  it("keeps primary actions at least 44 px", () => {
    expect(rule(studio, ".cx-btn")).toContain("min-height: 52px");
    expect(rule(studio, ".cx-btn.primary.sm")).toContain("min-height: 44px");
    expect(rule(studio, ".cx-input")).toContain("min-height: 44px");
    expect(rule(studio, ".cx-link")).toContain("min-height: 44px");
  });
});

describe("reduced motion", () => {
  it("stops the spinner and the shimmer", () => {
    const block = states.slice(
      states.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(block).toMatch(/\.cx-spin \.arc \{\s*animation: none;/);
    expect(block).toMatch(/\.cx-sk::after \{\s*animation: none;/);
  });
  it("removes lifts and transitions from buttons and keys", () => {
    const block = studio.slice(
      studio.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(block).toContain(".cx-btn,");
    expect(block).toContain("transition: none;");
    expect(block).toContain("transform: none;");
  });
});

describe("no remote assets (G13)", () => {
  it.each(["app.css", "studio.css", "states.css", "tokens.generated.css"])(
    "%s has no URL to another origin",
    (f) => {
      expect(css(f)).not.toMatch(
        /https?:\/\/|fonts\.googleapis|fonts\.gstatic|@import\s+url/,
      );
    },
  );
  it("bundles the three faces with their licences", () => {
    for (const f of [
      "Geist-latin.woff2",
      "GeistMono-latin.woff2",
      "Caveat-latin.woff2",
      "OFL-Geist.txt",
      "OFL-Caveat.txt",
    ])
      expect(
        readFileSync(new URL(`../../app/styles/fonts/${f}`, import.meta.url))
          .length,
      ).toBeGreaterThan(1000);
  });
});
