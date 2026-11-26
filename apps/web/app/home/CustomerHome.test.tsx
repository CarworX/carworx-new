import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import type { PublicListing } from "../server/catalogue/public";
import { CustomerHome, greetingFor } from "./CustomerHome";
import { clearRecent, readRecent, rememberView, RECENT_MAX } from "./recent";

const UUID = "de3c1000-0000-4000-8000-000000000001";

const listing = (extra: Partial<PublicListing> = {}): PublicListing => ({
  public_id: UUID,
  display_name: "Synthetic Shine",
  description: "Synthetic",
  metro: "Gauteng",
  mode: "fixed",
  service_slug: "wash",
  service_name: "Wash & valet",
  category_slug: "wash-and-detailing",
  category_name: "Wash & Detailing",
  public_address: null,
  public_latitude: null,
  public_longitude: null,
  verification_labels: [],
  ...extra,
});

function render(
  props: Partial<Parameters<typeof CustomerHome>[0]> = {},
): string {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <CustomerHome
          firstName="Thandi"
          listings={[]}
          now={new Date("2026-11-25T08:00:00Z")}
          {...props}
        />
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub initialEntries={["/"]} />);
}

describe("greetingFor (SAST, UTC+2)", () => {
  it("uses morning, afternoon and evening on South African time", () => {
    // 08:00 UTC is 10:00 SAST
    expect(greetingFor(new Date("2026-11-25T08:00:00Z"))).toBe("Good morning");
    // 11:00 UTC is 13:00 SAST
    expect(greetingFor(new Date("2026-11-25T11:00:00Z"))).toBe(
      "Good afternoon",
    );
    // 15:30 UTC is 17:30 SAST
    expect(greetingFor(new Date("2026-11-25T15:30:00Z"))).toBe("Good evening");
  });

  it("switches at 12:00 and 17:00 SAST exactly", () => {
    expect(greetingFor(new Date("2026-11-25T09:59:00Z"))).toBe("Good morning");
    expect(greetingFor(new Date("2026-11-25T10:00:00Z"))).toBe(
      "Good afternoon",
    );
    expect(greetingFor(new Date("2026-11-25T14:59:00Z"))).toBe(
      "Good afternoon",
    );
    expect(greetingFor(new Date("2026-11-25T15:00:00Z"))).toBe("Good evening");
  });
});

describe("CustomerHome markup", () => {
  it("greets by first name and offers the search and the five services", () => {
    const html = render();
    expect(html).toContain("Good morning, Thandi.");
    expect(html).toContain("What does your car need?");
    expect(html).toContain('action="/search"');
    expect(html).toContain('href="/c/wash-and-detailing"');
    expect(html).toContain('href="/fines"');
  });

  it("shows the not-verified fines state and no fine count", () => {
    const html = render();
    expect(html).toContain("Check your traffic fines");
    expect(html).not.toMatch(/\d+ fines? on your ID/);
  });

  it("hides the Comes to you row when no business is mobile", () => {
    const html = render({ listings: [listing({ mode: "fixed" })] });
    expect(html).toContain("Browse businesses");
    expect(html).not.toContain("Comes to you");
  });

  it("shows the Comes to you row only with mobile businesses", () => {
    const html = render({ listings: [listing({ mode: "mobile" })] });
    expect(html).toContain("Comes to you");
  });

  it("does not render recently viewed on the server (it reads the browser)", () => {
    expect(render()).not.toContain("Recently viewed");
  });
});

describe("recently viewed (this browser only)", () => {
  function memory() {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  }
  const view = (n: number) => ({
    id: `de3c1000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: `Business ${String(n)}`,
    service: "Wash",
  });

  it("keeps the newest three, most recent first, without repeats", () => {
    const s = memory();
    rememberView(view(1), s);
    rememberView(view(2), s);
    rememberView(view(3), s);
    rememberView(view(1), s);
    rememberView(view(4), s);
    const ids = readRecent(s).map((r) => r.name);
    expect(ids).toEqual(["Business 4", "Business 1", "Business 3"]);
    expect(ids.length).toBe(RECENT_MAX);
  });

  it("ignores junk in storage and non-UUID ids", () => {
    const s = memory();
    s.setItem(
      "cx-recent-views",
      JSON.stringify([
        { id: "not-a-uuid", name: "x", service: "y" },
        view(7),
        { id: UUID },
      ]),
    );
    expect(readRecent(s).map((r) => r.name)).toEqual(["Business 7"]);
  });

  it("returns nothing when storage is unavailable or unreadable", () => {
    expect(readRecent(null)).toEqual([]);
    const s = memory();
    s.setItem("cx-recent-views", "{not json");
    expect(readRecent(s)).toEqual([]);
  });

  it("clears the history", () => {
    const s = memory();
    rememberView(view(1), s);
    clearRecent(s);
    expect(readRecent(s)).toEqual([]);
  });
});
