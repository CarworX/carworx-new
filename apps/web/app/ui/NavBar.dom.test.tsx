// @vitest-environment happy-dom
// Regression test for the Codex review finding on #17: activating an in-page
// link (or an action) in the mobile sheet must close it and release its Tab trap.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { NavBar } from "./NavBar";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root.render(
      <NavBar
        items={[
          { href: "#how", label: "How it works" },
          { href: "#services", label: "Services" },
        ]}
        sheetActions={
          <button type="button" className="sheet-action">
            Find a service
          </button>
        }
      />,
    );
  });
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
});

const q = (sel: string): HTMLElement => {
  const el = host.querySelector<HTMLElement>(sel);
  if (!el) throw new Error(`missing ${sel}`);
  return el;
};
const sheet = () => q('[role="dialog"]');
const menu = () => q(".cx-menu");

/** True when the sheet's trap swallowed a Tab press. */
function tabIsTrapped(): boolean {
  const e = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  act(() => {
    document.dispatchEvent(e);
  });
  return e.defaultPrevented;
}

function openSheet() {
  act(() => {
    menu().click();
  });
  expect(sheet().hidden).toBe(false);
  expect(menu().getAttribute("aria-expanded")).toBe("true");
  expect(tabIsTrapped()).toBe(true); // the trap is live while the sheet is open
}

describe("NavBar sheet closes on activation", () => {
  it("an in-page link closes the sheet and frees Tab", () => {
    openSheet();
    act(() => {
      q('.cx-sheet a[href="#services"]').click();
    });
    expect(sheet().hidden).toBe(true);
    expect(menu().getAttribute("aria-expanded")).toBe("false");
    expect(tabIsTrapped()).toBe(false);
  });

  it("a sheet action closes the sheet and frees Tab", () => {
    openSheet();
    act(() => {
      q(".sheet-action").click();
    });
    expect(sheet().hidden).toBe(true);
    expect(tabIsTrapped()).toBe(false);
  });

  it("a click on the sheet's own padding keeps it open", () => {
    openSheet();
    act(() => {
      sheet().click();
    });
    expect(sheet().hidden).toBe(false);
  });
});
