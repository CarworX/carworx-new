import { renderToStaticMarkup } from "react-dom/server";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import GetListed from "./provider.get-listed.$step";

/**
 * Render smoke tests: the application in the Sites preview's onboarding
 * markup (onboarding/phase1). The real fields and their names are checked
 * here; saving and submitting stay covered by integration/providers.test.ts.
 */
const draft = {
  id: "app-1",
  business_name: "Shine Bay Car Wash",
  applicant_role: "owner",
  service_slugs: ["wash"],
  mode: "both",
  metro: "Johannesburg",
  public_address: "12 Bath Avenue, Rosebank",
  pin_lat: -26.146,
  pin_lng: 28.041,
  pin_source: "device",
  radius_km: 25,
  description: "Hand wash only. Same-day service.",
  hours: [1, 2, 3, 4, 5].map((day) => ({
    day,
    opens: "08:00",
    closes: "17:00",
  })),
  team_size_band: "2-5",
  trading_since: "2014-03-01",
  step: 5,
};

function render(step: string, extra: Record<string, unknown> = {}) {
  const Page = GetListed as unknown as (p: {
    loaderData: unknown;
    actionData?: unknown;
  }) => React.JSX.Element;
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <Page
          loaderData={{
            csrf: "csrf-token-for-test",
            draft,
            step,
            status: null,
            listingId: null,
            sentAt: null,
            mapEnabled: true,
            ...extra,
          }}
        />
      ),
    },
  ]);
  return renderToStaticMarkup(<Stub />)
    .replace(/<input([^>]*?) checked=""([^>]*)>/g, "<input$1$2 checked>")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

describe("/provider/get-listed: the preview application", () => {
  it("draws the focused bar, rail, segment bar and listing card", () => {
    const h = render("business");
    expect(h).toContain('class="ob-navwrap"');
    expect(h).toContain("Save and exit");
    expect(h).toContain('class="rail"');
    expect(h.match(/<li[^>]*aria-current="step"/g)).toHaveLength(1);
    expect(h).toContain('aria-valuetext="Step 1 of 5: Business"');
    expect(h).toContain('class="ob-card"');
    expect(h).toContain("Labels appear after an admin checks you");
    expect(h.match(/<h1\b/g)).toHaveLength(1);
    // Visible text only: kit.css names the bar's label class "ob-demo".
    const text = h.replace(/<[^>]*>/g, " ");
    expect(text).not.toMatch(/demo|fictional|example business application/i);
  });
  it("Save and exit saves the step first; Enter still means Next", () => {
    const h = render("business");
    const exit = h.match(/<button[^>]*>Save and exit<\/button>/)?.[0] ?? "";
    for (const attr of [
      'type="submit"',
      'form="application-step"',
      'name="exit"',
      'value="1"',
    ])
      expect(exit).toContain(attr);
    const first = h.match(/<button type="submit"[^>]*>([^<]*)</);
    expect(first?.[1]).toBe("Next");
    const check = render("check");
    expect(check).toMatch(
      /<a class="cx-btn outlined sm" href="\/provider">Exit<\/a>/,
    );
    expect(check).not.toContain('name="exit"');
  });
  it("business: name and role as real fields", () => {
    const h = render("business");
    expect(h).toContain("Tell us who you are");
    expect(h).toContain('name="businessName"');
    expect(h).toContain('value="Shine Bay Car Wash"');
    expect(h).toMatch(/name="role" value="owner"[^>]*checked/);
    expect(h).toContain('name="csrf"');
    expect(h).toContain('href="/search"');
  });
  it("service: services, how you work and team size", () => {
    const h = render("service");
    expect(h).toContain("What you offer");
    expect(h).toMatch(/name="services" value="wash"[^>]*checked/);
    expect(h).toMatch(/name="work" value="fixed"[^>]*checked/);
    expect(h).toMatch(/name="work" value="mobile"[^>]*checked/);
    expect(h).toMatch(/name="team" value="2-5"[^>]*checked/);
  });
  it("location: metro, the map, address and a private travel radius", () => {
    const h = render("location");
    expect(h).toContain("Where customers find you");
    expect(h).toContain('name="metro"');
    expect(h).toContain('class="ob-mapsearch"');
    expect(h).toContain("Open the map");
    expect(h).toContain('name="address"');
    expect(h).toContain('name="radiusKm"');
    expect(h).toMatch(/name="pinLat" value="-26.146"/);
    expect(h).toContain("Customers never see your base or your");
  });
  it("about: day chips, one pair of times, trading since and the line", () => {
    const h = render("about");
    expect(h).toMatch(/name="open-1" value="on"[^>]*checked/);
    expect(h).not.toMatch(/name="open-6" value="on"[^>]*checked/);
    expect(h).toContain('name="opens"');
    expect(h).toContain('name="closes"');
    expect(h).toContain('name="since"');
    expect(h).toContain('value="2014-03-01"');
    expect(h).toContain('name="description"');
    expect(h).toContain("+ Hand wash only");
  });
  it("check: every answer with a Change link, then the confirmations", () => {
    const h = render("check");
    expect(h).toContain("Is this right?");
    expect(h).toContain('class="ob-review"');
    expect(h).toContain("Mon–Fri · 08:00–17:00");
    expect(h).toContain("travels up to 25 km (never shown)");
    expect(h).toContain('name="adult"');
    expect(h).toContain('name="probing"');
    expect(h).toContain('value="submit"');
    expect(h).toContain("Send application");
  });
  it("submitted: the preview's sent card with what happens next", () => {
    const h = render("submitted", {
      status: "submitted",
      sentAt: "2026-11-17 09:04 SAST",
    });
    expect(h).toContain("Application sent");
    expect(h).toContain("Sent · 2026-11-17 09:04 SAST");
    expect(h).toContain("What happens next");
    expect(h).toContain('href="/provider"');
    expect(h).not.toContain("booking");
  });
});
