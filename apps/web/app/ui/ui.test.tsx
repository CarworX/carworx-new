import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button, ButtonLink } from "./Button";
import { FilterChip, StatusLabel, TimeSlots } from "./Chip";
import { ConsentCheckbox, Segmented, TextField } from "./Field";
import { HoldDial, mmss, timeInWords } from "./HoldDial";
import { Icon } from "./Icon";
import { ICON_NAMES } from "./icons.generated";
import { NavBar } from "./NavBar";
import { StatusNote } from "./Note";
import { ServiceKeys } from "./ServiceKeys";
import { keepAmp, SERVICES } from "./services";
import { NotFound } from "./states/NotFound";
import { biAngle, pulseFront } from "./states/ripple";
import { SkeletonCard, SkeletonGroup } from "./states/Skeleton";
import { StepDial } from "./states/StepDial";
import { StepList } from "./StepList";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe("G8 consent", () => {
  it("renders unticked, with no checked default", () => {
    const h = html(
      <ConsentCheckbox name="terms">I agree to the terms.</ConsentCheckbox>,
    );
    expect(h).toContain('type="checkbox"');
    expect(h).not.toMatch(/\bchecked\b/);
  });
  it("offers no way to pre-tick it", () => {
    type Props = Parameters<typeof ConsentCheckbox>[0];
    const ticked: Props = {
      name: "x",
      children: "x",
      // @ts-expect-error -- no checked prop, by design (POPIA)
      checked: true,
    };
    const preset: Props = {
      name: "x",
      children: "x",
      // @ts-expect-error -- nor defaultChecked
      defaultChecked: true,
    };
    // Even if one is forced through, the input still renders unticked.
    expect(html(<ConsentCheckbox {...ticked} />)).not.toMatch(/\bchecked\b/);
    expect(html(<ConsentCheckbox {...preset} />)).not.toMatch(/\bchecked\b/);
  });
});

describe("G9 nav marks the current section", () => {
  const items = [
    { href: "/how", label: "How it works" },
    { href: "/services", label: "Services" },
    { href: "/help", label: "Help" },
  ];
  it("sets aria-current=page on the current item only (bar and sheet)", () => {
    const h = html(<NavBar items={items} current="/services" />);
    expect(count(h, /aria-current="page"/g)).toBe(2);
    expect(h).toMatch(/<a href="\/services" aria-current="page">Services<\/a>/);
    expect(h).not.toMatch(/href="\/how" aria-current/);
  });
  it("sets none when no section is current", () => {
    expect(html(<NavBar items={items} />)).not.toContain("aria-current");
  });
  it("the menu button names and controls the sheet", () => {
    const h = html(<NavBar items={items} />);
    expect(h).toMatch(
      /aria-expanded="false" aria-controls="[^"]+" aria-label="Open menu"/,
    );
    expect(h).toMatch(/role="dialog" aria-label="Menu" hidden/);
  });
});

describe("G12 StepList", () => {
  it("puts the number in .n beside the icon, not on a bare span", () => {
    const h = html(
      <StepList
        steps={[
          { actor: "driver", icon: "search", title: "Ask", body: "b" },
          { actor: "business", icon: "clock", title: "Accept", body: "c" },
        ]}
        active={1}
      />,
    );
    expect(
      count(
        h,
        /<span class="n" aria-hidden="true">0\d<\/span><svg class="cx-ic lg"/g,
      ),
    ).toBe(2);
    expect(count(h, /aria-current="step"/g)).toBe(1);
  });
});

describe("buttons", () => {
  it("defaults to type=button and shows the spinner when busy", () => {
    expect(html(<Button>Go</Button>)).toContain('type="button"');
    const h = html(
      <Button variant="primary" busy>
        Sending request
      </Button>,
    );
    expect(h).toContain('aria-busy="true"');
    expect(h).toContain('class="cx-spin"');
  });
  it("the arrow disc is decorative", () => {
    expect(
      html(
        <ButtonLink href="/s" arrow>
          Find
        </ButtonLink>,
      ),
    ).toMatch(/<span class="arr" aria-hidden="true">/);
  });
});

describe("chips, labels, slots, fields", () => {
  it("a filter chip carries aria-pressed", () => {
    expect(html(<FilterChip>Open Saturday</FilterChip>)).toContain(
      'aria-pressed="false"',
    );
    expect(
      html(<FilterChip defaultPressed>Open Saturday</FilterChip>),
    ).toContain('aria-pressed="true"');
  });
  it("a status label is always icon plus word", () => {
    const h = html(<StatusLabel tone="err">Payment failed</StatusLabel>);
    expect(h).toContain("cx-label err");
    expect(h).toContain("Payment failed");
  });
  it("slots: none chosen by default, taken ones disabled and announced", () => {
    const h = html(
      <TimeSlots
        legend="Times"
        options={[{ time: "08:00", taken: true }, { time: "09:00" }]}
      />,
    );
    expect(h).not.toMatch(/\bchecked\b/);
    expect(count(h, /disabled=""/g)).toBe(1);
    expect(h).toContain("(taken)");
  });
  it("fields have a visible label, and errors are linked", () => {
    const h = html(
      <TextField
        label="Mobile number"
        error="Check the number."
        hint="Used only for this"
      />,
    );
    const id = /<label for="([^"]+)">Mobile number<\/label>/.exec(h)?.[1];
    expect(id).toBeTruthy();
    expect(h).toContain(
      `aria-describedby="${String(id)}-hint ${String(id)}-err"`,
    );
    expect(h).toContain('aria-invalid="true"');
  });
  it("segmented control is a radio group", () => {
    const h = html(
      <Segmented
        legend="Show as"
        options={[
          { value: "list", label: "List" },
          { value: "map", label: "Map" },
        ]}
      />,
    );
    expect(count(h, /type="radio"/g)).toBe(2);
    expect(h).toContain("<legend");
  });
  it("an error note is an alert with an icon and words", () => {
    expect(
      html(
        <StatusNote tone="err" title="Failed.">
          Nothing was taken.
        </StatusNote>,
      ),
    ).toMatch(/role="alert".*<svg.*<b>Failed\.<\/b>/s);
  });
});

describe("icons", () => {
  it("draws every Studio glyph in currentColor", () => {
    expect(ICON_NAMES).toHaveLength(25);
    for (const n of ICON_NAMES) {
      const h = html(<Icon name={n} />);
      expect(h).toContain('stroke="currentColor"');
      expect(h).toContain('aria-hidden="true"');
    }
    expect(html(<Icon name="info" label="Information" />)).toContain(
      'role="img" aria-label="Information"',
    );
  });
});

describe("hold dial", () => {
  it("names the time in words for screen readers", () => {
    expect(timeInWords(872)).toBe("14 minutes 32 seconds left");
    expect(timeInWords(60)).toBe("1 minute left");
    expect(timeInWords(0)).toBe("Time is up");
    expect(mmss(872)).toBe("14:32");
    const h = html(<HoldDial secondsLeft={872} />);
    expect(h).toContain(
      'role="img" aria-label="14 minutes 32 seconds left on the hold"',
    );
    expect(h).toContain("stroke-dashoffset:15.6"); // 502.7 × 28 / 900
  });
  it("switches to ok when paid", () => {
    expect(html(<HoldDial secondsLeft={0} paid />)).toContain(
      'class="cx-dial done"',
    );
  });
});

describe("services and keys", () => {
  it("are always all five, in order, with the full wording", () => {
    expect(SERVICES.map((s) => s.label)).toEqual([
      "Wash & Detailing",
      "Repairs & Maintenance",
      "Glass Repair & Replacement",
      "Tyres & Wheel Alignment",
      "Fines & Vehicle Admin",
    ]);
    const hrefs = {
      wash: "/w",
      repairs: "/r",
      glass: "/g",
      tyres: "/t",
      fines: "/f",
    };
    expect(count(html(<ServiceKeys hrefs={hrefs} />), /class="cx-key"/g)).toBe(
      5,
    );
  });
  it("keeps & with the word before it", () => {
    expect(keepAmp("Wash & Detailing")).toBe("Wash & Detailing");
  });
});

describe("D-041 states", () => {
  it("the 404 has the brand book's copy, actions and five chips", () => {
    const h = html(<NotFound />);
    expect(h).toContain("Error 404 · page not found");
    expect(h).toMatch(
      /<h1><span>We can(&#x27;|')t find that page\.<\/span><span class="grey">It may have moved\.<\/span><\/h1>/,
    );
    expect(h).toContain(
      "Check the address for a typo, or start again from home.",
    );
    expect(h).toMatch(/<a href="\/" class="cx-btn primary arrow">Back to home/);
    expect(h).toContain(">Find a service</a>");
    expect(count(h, /href="\/search\?service=/g)).toBe(5);
    expect(h).toContain('<canvas class="fx" aria-hidden="true">');
  });
  it("embedded, the 404 drops to h2 and no second main", () => {
    const h = html(<NotFound embedded />);
    expect(h).not.toContain("<main");
    expect(h).toContain("<h2>");
  });
  it("the step dial is a progress bar with a polite status line", () => {
    const h = html(
      <StepDial steps={["One…", "Two…"]} step={1} progress={0.5} />,
    );
    expect(h).toContain('role="progressbar"');
    expect(h).toContain('aria-valuenow="1" aria-valuetext="Step 2 of 2"');
    expect(h).toMatch(/role="status" aria-live="polite">Two…</);
    expect(html(<StepDial steps={["One…"]} step={1} />)).toContain(
      "Done. Showing results.",
    );
  });
  it("skeletons are hidden from assistive tech behind one status", () => {
    const h = html(
      <SkeletonGroup label="Loading results">
        <SkeletonCard />
      </SkeletonGroup>,
    );
    expect(h).toMatch(
      /^<div role="status"><span class="cx-vh">Loading results<\/span><div aria-hidden="true"/,
    );
  });
  it("the ripple rotor ratchets 72° per 1.2 s and the blade pulse alternates", () => {
    expect(biAngle(0.3, 0)).toBeCloseTo(1.8, 5); // the index lands with the 1.8° overshoot
    expect(biAngle(2.2, 0)).toBeCloseTo(72, 1); // settled one blade on
    // the clock is t + 0.9; each 1.2 s step runs its front for 0.45 s, then holds
    const out = pulseFront(2.0, false); // step 2 (even): hub → tips, held at the tips
    const back = pulseFront(0.8, false); // step 1 (odd): tips → hub, held at the hub
    expect(out).toBeCloseTo(102, 5);
    expect(back).toBeCloseTo(19, 5);
  });
});
