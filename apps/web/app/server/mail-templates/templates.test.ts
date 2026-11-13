import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  dateTime,
  dateTimeYear,
  duration,
  esc,
  money,
  safeLink,
  time,
} from "./format";
import { SAMPLES, SAMPLE_ORIGIN } from "./samples";
import { render, renderAuthEmail, type MailTemplate } from "./templates";

const ALL = Object.values(SAMPLES);
const HOSTILE = `<script>alert("x")</script> & 'Co' <img src=x onerror=alert(1)>`;

function count(haystack: string, needle: string | RegExp): number {
  return (haystack.match(new RegExp(needle, "g")) ?? []).length;
}

describe("every template, with synthetic data", () => {
  for (const t of ALL) {
    it(`${t.kind}: one ink action, hosted logo only, plain-text twin, legal footer`, () => {
      const r = render(t, SAMPLE_ORIGIN);
      expect(r.subject.length).toBeGreaterThan(5);
      expect(r.subject).not.toMatch(/[\r\n]/);
      expect(r.html.startsWith("<!doctype html>")).toBe(true);
      // One primary action, always ink.
      expect(count(r.html, 'class="cx-btn"')).toBe(1);
      expect(r.html).toMatch(/class="cx-btn" bgcolor="#0d0f12"/);
      // Images: the hosted PNG logo only. No pixels, no SVG, no http.
      expect(count(r.html, "<img ")).toBe(1);
      expect(r.html).toContain(
        `${SAMPLE_ORIGIN}/email/carworx-lockup-on-ink@2x.png`,
      );
      expect(r.html).not.toMatch(/\.svg|width="1" height="1"|http:\/\//);
      expect(r.html).not.toMatch(/<script|javascript:/i);
      // Footer: sender, replies, legal placeholders, privacy.
      for (const s of [
        "no-reply@carworx.app",
        "support@carworx.app",
        "CarworX (Pty) Ltd",
        "OQ-L2",
        `${SAMPLE_ORIGIN}/privacy`,
      ])
        expect(r.html).toContain(s);
      // The plain-text part carries the action URL and the same footer.
      const action =
        /<a href="([^"]+)" style="display:inline-block;padding:14px 28px/.exec(
          r.html,
        )?.[1];
      expect(action).toBeDefined();
      expect(r.text).toContain((action ?? "").replaceAll("&amp;", "&"));
      expect(r.text).toContain("support@carworx.app");
      expect(r.text).not.toMatch(/<[a-z]/i);
    });
  }
});

describe("colour carries meaning", () => {
  const SIGNAL = "#ff3b0a";
  const deadlines = new Set(["verify", "reset", "invite", "booking_request"]);
  const confirmed = new Set(["booking_confirmed", "welcome_business_approved"]);
  for (const t of ALL) {
    it(`${t.kind}: signal only on deadlines, blue only on confirmed`, () => {
      const { html } = render(t, SAMPLE_ORIGIN);
      expect(html.includes(SIGNAL)).toBe(deadlines.has(t.kind));
      expect(html.includes("cx-chip-blue")).toBe(confirmed.has(t.kind));
    });
  }
});

describe("user-supplied fields are escaped", () => {
  const evil = { name: HOSTILE, demo: true };
  const cases: MailTemplate[] = [
    {
      ...(SAMPLES.invite as Extract<MailTemplate, { kind: "invite" }>),
      business: evil,
      inviterFirstName: HOSTILE,
    },
    {
      ...(SAMPLES.enquiry_received as Extract<
        MailTemplate,
        { kind: "enquiry_received" }
      >),
      business: evil,
      service: HOSTILE,
    },
    {
      ...(SAMPLES.booking_request as Extract<
        MailTemplate,
        { kind: "booking_request" }
      >),
      customerFirstName: HOSTILE,
      service: HOSTILE,
      vehicle: HOSTILE,
    },
    {
      ...(SAMPLES.booking_confirmed as Extract<
        MailTemplate,
        { kind: "booking_confirmed" }
      >),
      business: evil,
      address: HOSTILE,
    },
    {
      ...(SAMPLES.reschedule as Extract<MailTemplate, { kind: "reschedule" }>),
      business: evil,
      service: HOSTILE,
    },
    {
      ...(SAMPLES.cancellation as Extract<
        MailTemplate,
        { kind: "cancellation" }
      >),
      business: evil,
      service: HOSTILE,
    },
    {
      ...(SAMPLES.receipt as Extract<MailTemplate, { kind: "receipt" }>),
      business: evil,
      businessArea: HOSTILE,
      method: HOSTILE,
      lines: [{ label: HOSTILE, amountMinor: 100 }],
    },
    {
      ...(SAMPLES.welcome_customer as Extract<
        MailTemplate,
        { kind: "welcome_customer" }
      >),
      firstName: HOSTILE,
    },
    {
      ...(SAMPLES.welcome_business_received as Extract<
        MailTemplate,
        { kind: "welcome_business_received" }
      >),
      business: evil,
    },
    {
      ...(SAMPLES.welcome_business_approved as Extract<
        MailTemplate,
        { kind: "welcome_business_approved" }
      >),
      business: evil,
    },
    {
      ...(SAMPLES.welcome_team as Extract<
        MailTemplate,
        { kind: "welcome_team" }
      >),
      business: evil,
      inviterFirstName: HOSTILE,
    },
  ];
  for (const t of cases) {
    it(`${t.kind}: no markup survives`, () => {
      const r = render(t, SAMPLE_ORIGIN);
      expect(r.html).not.toMatch(/<script|<img src=x/i);
      expect(r.html).toContain("&lt;script&gt;");
      expect(count(r.html, "<img ")).toBe(1);
    });
  }

  it("strips line breaks and bidi controls from names, so subjects can't carry headers", () => {
    const r = render(
      {
        ...(SAMPLES.invite as Extract<MailTemplate, { kind: "invite" }>),
        business: { name: "Gleam\r\nBcc: x@example.test‮", demo: false },
      },
      SAMPLE_ORIGIN,
    );
    expect(r.subject).toBe(
      "You're invited to join Gleam Bcc: x@example.test on CarworX",
    );
    expect(r.html).not.toContain("‮");
  });

  it("refuses links off the app's origin or not https", () => {
    for (const link of [
      "https://evil.example.test/auth/confirm",
      "javascript:alert(1)",
      "http://carworx.app/x",
      "data:text/html,hi",
    ])
      expect(() =>
        render({ kind: "verify", link, expiresInMs: 3_600_000 }, SAMPLE_ORIGIN),
      ).toThrow();
    expect(() =>
      render(
        {
          ...(SAMPLES.receipt as Extract<MailTemplate, { kind: "receipt" }>),
          pdfLink: "https://evil.example.test/r.pdf",
        },
        SAMPLE_ORIGIN,
      ),
    ).toThrow();
    expect(safeLink("http://localhost:5173/x", "http://localhost:5173")).toBe(
      "http://localhost:5173/x",
    );
  });

  it("refuses malformed references and empty receipts", () => {
    expect(() =>
      render(
        {
          ...(SAMPLES.enquiry_received as Extract<
            MailTemplate,
            { kind: "enquiry_received" }
          >),
          ref: "<b>",
        },
        SAMPLE_ORIGIN,
      ),
    ).toThrow("mail_reference");
    expect(() =>
      render(
        {
          ...(SAMPLES.receipt as Extract<MailTemplate, { kind: "receipt" }>),
          lines: [],
        },
        SAMPLE_ORIGIN,
      ),
    ).toThrow("mail_receipt_lines");
  });
});

describe("CarworX formats", () => {
  it("writes money as R2 430 and times in SAST", () => {
    expect(money(243_000)).toBe("R2 430");
    expect(money(83_000)).toBe("R830");
    expect(money(1_234_567_850)).toBe("R12 345 678.50");
    expect(money(0)).toBe("R0");
    expect(() => money(1.5)).toThrow();
    expect(time("2026-11-14T12:32:00Z")).toBe("14:32");
    expect(dateTime("2026-10-31T07:00:00Z")).toBe("Sat 31 Oct, 09:00");
    expect(dateTimeYear("2026-11-14T12:32:00Z")).toBe("Sat 14 Nov 2026, 14:32");
    expect(duration(3_600_000)).toBe("1 hour");
    expect(duration(7 * 86_400_000)).toBe("7 days");
    expect(duration(15 * 60_000)).toBe("15 minutes");
    expect(esc(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("marks demo businesses DEMO in both parts", () => {
    const r = render(SAMPLES.receipt, SAMPLE_ORIGIN);
    expect(r.html).toContain(">DEMO</span>");
    expect(r.text).toContain("Gleamline (DEMO)");
  });

  it("totals the receipt from its lines", () => {
    const r = render(SAMPLES.receipt, SAMPLE_ORIGIN);
    expect(r.subject).toBe("Your CarworX receipt CX-2048");
    expect(r.text).toContain("Total paid  R830");
    expect(r.text).toContain(
      "Download PDF receipt: https://carworx.app/receipts/CX-2048.pdf",
    );
  });
});

// The Supabase Auth templates are generated from the same renderer, with Go
// template placeholders for the link and origin. UPDATE_AUTH_TEMPLATES=1
// rewrites them; otherwise this fails when they drift.
describe("Supabase Auth templates", () => {
  const SITE = "{{ .SiteURL }}";
  const files = {
    confirmation: { action: "signup", type: "email" },
    recovery: { action: "recovery", type: "recovery" },
  } as const;
  for (const [file, { action, type }] of Object.entries(files)) {
    it(`supabase/templates/${file}.html matches renderAuthEmail("${action}")`, () => {
      const path = fileURLToPath(
        new URL(
          `../../../../../supabase/templates/${file}.html`,
          import.meta.url,
        ),
      );
      const link = `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}`;
      const { html } = renderAuthEmail(action, link, SITE);
      expect(html).toContain(
        `href="${SITE}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}"`,
      );
      expect(html).toContain("Link expires in 1 hour");
      if (process.env["UPDATE_AUTH_TEMPLATES"] === "1")
        writeFileSync(path, html);
      expect(readFileSync(path, "utf8")).toBe(html);
    });
  }

  it("renders the staging hook's emails with the same design as the templates", () => {
    const link = `${SAMPLE_ORIGIN}/auth/confirm?token_hash=abc12345&type=email`;
    expect(renderAuthEmail("signup", link, SAMPLE_ORIGIN)).toEqual(
      render({ kind: "verify", link, expiresInMs: 3_600_000 }, SAMPLE_ORIGIN),
    );
    expect(renderAuthEmail("recovery", link, SAMPLE_ORIGIN).subject).toBe(
      "Reset your CarworX password",
    );
  });
});
