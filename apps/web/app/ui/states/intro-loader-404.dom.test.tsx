// @vitest-environment happy-dom
// The owner's three motion/state screens (14 Nov 2026): the first-visit intro
// plays once and never under reduced motion, the page loader never shows for
// a wait under 300 ms, and the 404 renders the design's copy and real links.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isPageLoadClick,
  LOADER_DELAY_MS,
  useDelayedFlag,
} from "./NavigationLoader";
import { NotFound } from "./NotFound";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// Vitest runs from apps/web.
const INTRO = readFileSync(resolve("public/intro/intro.js"), "utf8");

function runIntro(reduced: boolean) {
  document.body.innerHTML = '<div id="cx-intro" hidden></div>';
  window.matchMedia = ((q: string) => ({
    matches: reduced && q.includes("reduce"),
  })) as unknown as typeof window.matchMedia;
  window.requestAnimationFrame = () => 0;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the shipped script, as the browser runs it
  (new Function(INTRO) as () => void)();
  return document.getElementById("cx-intro");
}

describe("first-visit intro", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("plays the first time, then never again in that browser", () => {
    expect(runIntro(false)?.hidden).toBe(false);
    expect(localStorage.getItem("cx-intro-seen")).toBe("1");
    expect(runIntro(false)?.hidden).toBe(true);
  });

  it("never plays with reduced motion", () => {
    expect(runIntro(true)?.hidden).toBe(true);
    expect(localStorage.getItem("cx-intro-seen")).toBeNull();
  });

  it("is skipped by any key", () => {
    vi.useFakeTimers();
    const el = runIntro(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: " " }));
    expect(el?.style.opacity).toBe("0");
    vi.advanceTimersByTime(300);
    expect(el?.hidden).toBe(true);
    vi.useRealTimers();
  });
});

describe("page loader delay", () => {
  let host: HTMLDivElement;
  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("div");
    document.body.appendChild(host);
  });
  afterEach(() => {
    vi.useRealTimers();
    host.remove();
  });

  function Probe({ active }: { active: boolean }) {
    return <span>{useDelayedFlag(active) ? "shown" : "hidden"}</span>;
  }

  it("is not shown for a wait under 300 ms, and is shown after", () => {
    const root = createRoot(host);
    act(() => {
      root.render(<Probe active />);
    });
    act(() => {
      vi.advanceTimersByTime(LOADER_DELAY_MS - 1);
    });
    expect(host.textContent).toBe("hidden");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(host.textContent).toBe("shown");
    act(() => {
      root.render(<Probe active={false} />);
    });
    expect(host.textContent).toBe("hidden");
    act(() => {
      root.unmount();
    });
  });

  it("covers only real same-site page loads", () => {
    const here = new URL("https://carworx.app/fines");
    const click = {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
    };
    const a = (href: string, target = "", download = false) => ({
      href: new URL(href, here).href,
      target,
      hasAttribute: (n: string) => n === "download" && download,
    });
    expect(isPageLoadClick(click, a("/search"), here)).toBe(true);
    expect(isPageLoadClick(click, a("#top"), here)).toBe(false);
    expect(isPageLoadClick(click, a("mailto:x@example.test"), here)).toBe(
      false,
    );
    expect(isPageLoadClick(click, a("https://example.test/"), here)).toBe(
      false,
    );
    expect(isPageLoadClick(click, a("/search", "_blank"), here)).toBe(false);
    expect(isPageLoadClick(click, a("/file", "", true), here)).toBe(false);
    expect(
      isPageLoadClick({ ...click, metaKey: true }, a("/search"), here),
    ).toBe(false);
  });
});

describe("404", () => {
  it("renders the design copy, one h1 and the real links", () => {
    const html = renderToStaticMarkup(<NotFound still />).replace(
      /&#x27;/g,
      "'",
    );
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("We can't find that page.");
    expect(html).toContain("It may have moved.");
    expect(html).toMatch(/Error 404/i);
    expect(html).toContain('href="/search"');
    for (const href of [
      "/c/wash-and-detailing",
      "/c/repairs-and-maintenance",
      "/c/glass-repair-and-replacement",
      "/c/tyres-and-wheel-alignment",
      "/fines",
    ])
      expect(html).toContain(`href="${href}"`);
  });
});
