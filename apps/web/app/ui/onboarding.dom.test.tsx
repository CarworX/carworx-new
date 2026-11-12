// @vitest-environment happy-dom
// Claude 23 O1: the gliding segmented bar, the one-line filter bar and the
// account menu, exercised in a DOM (behaviour the static-markup tests miss).
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountMenu } from "./NavBar";
import { FilterBar } from "./ScrollBar";
import { SegmentedProgress } from "./SegmentedProgress";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
  vi.restoreAllMocks();
});

const all = (sel: string) => [...host.querySelectorAll<HTMLElement>(sel)];
const q = (sel: string): HTMLElement => {
  const el = host.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};

function bar(step: number) {
  act(() => {
    root.render(
      <SegmentedProgress
        step={step}
        total={6}
        name={`S${String(step)}`}
        label="Progress"
      />,
    );
  });
}
const onSegs = () => all(".seg").map((s) => s.classList.contains("on"));
const delays = () =>
  all(".seg i").map((i) => parseInt(i.style.transitionDelay || "0", 10));

function reducedMotion(on: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: on && query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe("SegmentedProgress", () => {
  it("fills forward and drains back on the right segments", () => {
    reducedMotion(false);
    bar(1);
    expect(onSegs()).toEqual([true, true, false, false, false, false]);
    expect(q(".cx-segbar").classList.contains("still")).toBe(false); // ready after first paint
    bar(2);
    expect(onSegs()).toEqual([true, true, true, false, false, false]);
    expect(q(".segname").classList.contains("fwd")).toBe(true);
    bar(0);
    expect(onSegs()).toEqual([true, false, false, false, false, false]);
    expect(q(".segname").classList.contains("back")).toBe(true);
    expect(q('[role="progressbar"]').getAttribute("aria-valuetext")).toBe(
      "Step 1 of 6: S0",
    );
  });

  it("chains a jump in order: forward left to right, back right to left", () => {
    reducedMotion(false);
    bar(0);
    bar(3); // 3 segments fill: 1, 2, 3
    expect(delays()).toEqual([0, 0, 213, 426, 0, 0]);
    bar(0); // drain 3, 2, 1
    expect(delays()).toEqual([0, 426, 213, 0, 0, 0]);
  });

  it("has no chain delays under reduced motion", () => {
    reducedMotion(true);
    bar(0);
    bar(5);
    expect(delays().every((d) => d === 0)).toBe(true);
    expect(onSegs().every(Boolean)).toBe(true);
  });
});

function Filters() {
  const [v, setV] = useState("a");
  return (
    <FilterBar
      label="Filter"
      value={v}
      onChange={setV}
      options={["a", "b", "c", "d"].map((x) => ({ value: x, label: x }))}
    />
  );
}

describe("FilterBar", () => {
  it("fades only the side with more, and scrolls the chosen chip into view", () => {
    act(() => {
      root.render(<Filters />);
    });
    const el = q(".cx-filterbar");
    expect(el.getAttribute("role")).toBe("group");
    // No layout in happy-dom: give the bar a narrow box and wide content.
    let left = 0;
    Object.defineProperty(el, "scrollWidth", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(el, "clientWidth", {
      configurable: true,
      value: 200,
    });
    Object.defineProperty(el, "offsetLeft", { configurable: true, value: 0 });
    Object.defineProperty(el, "scrollLeft", {
      configurable: true,
      get: () => left,
      set: (x: number) => {
        left = x;
      },
    });
    all(".cx-chip").forEach((b, i) => {
      Object.defineProperty(b, "offsetLeft", {
        configurable: true,
        value: i * 100,
      });
      Object.defineProperty(b, "offsetWidth", {
        configurable: true,
        value: 90,
      });
    });
    act(() => {
      el.dispatchEvent(new Event("scroll"));
    });
    expect(el.className).toContain("more-r");
    expect(el.className).not.toContain("more-l");

    act(() => {
      all(".cx-chip")[3]?.click();
    });
    expect(all(".cx-chip")[3]?.getAttribute("aria-pressed")).toBe("true");
    expect(left).toBe(292); // 300 - 8 px breathing room
    expect(el.className).toContain("more-l");
  });
});

describe("AccountMenu", () => {
  it("opens, closes on Esc and returns focus to the avatar", () => {
    act(() => {
      root.render(
        <AccountMenu
          account={{
            name: "Test Owner",
            sub: "Owner",
            initials: "TO",
            links: [{ href: "/account", label: "Profile and settings" }],
            csrf: "t",
          }}
        />,
      );
    });
    const me = q(".cx-acct-me");
    const drop = q(".cx-acct-drop");
    expect(drop.hidden).toBe(true);
    act(() => {
      me.click();
    });
    expect(drop.hidden).toBe(false);
    expect(me.getAttribute("aria-expanded")).toBe("true");
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(drop.hidden).toBe(true);
    expect(document.activeElement).toBe(me);
  });

  it("closes on a pointer-down outside", () => {
    act(() => {
      root.render(
        <AccountMenu
          account={{
            name: "A",
            sub: "B",
            initials: "AB",
            links: [],
            csrf: "t",
          }}
        />,
      );
    });
    act(() => {
      q(".cx-acct-me").click();
    });
    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(q(".cx-acct-drop").hidden).toBe(true);
  });
});
