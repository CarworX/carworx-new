import { describe, expect, it } from "vitest";

import {
  claimCursor,
  parseApplication,
  parseClaimCursor,
  parseClaim,
  parseDecision,
  parseDescription,
  parseId,
  problemFrom,
  PROBLEM_TEXT,
} from "./forms";

function form(values: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values))
    for (const item of Array.isArray(v) ? v : [v]) f.append(k, item);
  return f;
}

const fixed = {
  businessName: "Synthetic Motors",
  service: "service",
  mode: "fixed",
  metro: "Gauteng",
  description: "Synthetic workshop description",
  address: "1 Synthetic Road, Exampleville",
  latitude: "-26.2041",
  longitude: "28.0473",
  confirm: "on",
};

describe("parseApplication", () => {
  it("accepts a fixed-premises application", () => {
    expect(parseApplication(form(fixed))).toEqual({
      p_business_name: "Synthetic Motors",
      p_service_slug: "service",
      p_mode: "fixed",
      p_metro: "Gauteng",
      p_description: "Synthetic workshop description",
      p_address: "1 Synthetic Road, Exampleville",
      p_lat: -26.2041,
      p_lng: 28.0473,
      p_radius_km: null,
    });
  });

  it("accepts a mobile application and drops any address", () => {
    const parsed = parseApplication(
      form({ ...fixed, mode: "mobile", radiusKm: "25" }),
    );
    expect(parsed?.p_address).toBeNull();
    expect(parsed?.p_radius_km).toBe(25);
  });

  it.each([
    ["no confirmation", { confirm: "" }],
    ["unknown service", { service: "rockets" }],
    ["unknown mode", { mode: "drone" }],
    ["pin outside South Africa", { latitude: "51.5" }],
    ["longitude outside South Africa", { longitude: "10" }],
    ["non-numeric pin", { latitude: "south" }],
    ["too many decimals", { latitude: "-26.123456789" }],
    ["short description", { description: "short" }],
    ["control character", { businessName: "Synthetic\u0007Motors" }],
    ["fixed without address", { address: "" }],
  ])("rejects %s", (_label, change) => {
    expect(parseApplication(form({ ...fixed, ...change }))).toBeNull();
  });

  it.each(["0", "101", "2.5", ""])("rejects mobile radius %j", (radiusKm) => {
    expect(
      parseApplication(form({ ...fixed, mode: "mobile", radiusKm })),
    ).toBeNull();
  });
});

describe("parseDescription", () => {
  it("keeps line breaks, normalised to \\n, and trims the ends", () => {
    expect(
      parseDescription(
        form({
          description: "  Synthetic line one\r\nline two\rline three\n ",
        }),
      ),
    ).toBe("Synthetic line one\nline two\nline three");
  });

  it.each([
    ["a tab", "Synthetic\tworkshop description"],
    ["a bell", "Synthetic\u0007workshop description"],
    ["too short once trimmed", "  short \n\n "],
  ])("rejects %s", (_label, description) => {
    expect(parseDescription(form({ description }))).toBeNull();
  });

  it("an application accepts a multi-line description", () => {
    expect(
      parseApplication(
        form({ ...fixed, description: "Synthetic workshop\r\nOpen weekdays" }),
      )?.p_description,
    ).toBe("Synthetic workshop\nOpen weekdays");
  });
});

describe("parseClaimCursor", () => {
  const id = "0b0b5f4e-2f8c-4b55-9a52-6a5f3c7d1e20";
  it("round-trips a PostgREST timestamp and id", () => {
    const at = "2026-01-01T12:00:00.123456+00:00";
    expect(parseClaimCursor(claimCursor({ created_at: at, id }))).toEqual({
      at,
      id,
    });
  });

  it("no cursor is the first page", () => {
    expect(parseClaimCursor(null)).toBeNull();
  });

  it.each([
    "",
    "not-a-cursor",
    `2026-01-01T12:00:00Z_${id}x`,
    `2026-13-45T12:00:00Z_${id}`,
    `2026-01-01T12:00:00Z,id.gt.0_${id}`,
    `2026-01-01T12:00:00Z_${id.toUpperCase()}`,
    `"2026-01-01T12:00:00Z"_${id}`,
  ])("rejects %j", (value) => {
    expect(parseClaimCursor(value)).toBe("invalid");
  });
});

describe("parseClaim", () => {
  it("business email needs no reference", () => {
    expect(
      parseClaim(form({ evidence: "business_email", documentReference: "x" })),
    ).toEqual({ p_evidence: "business_email", p_document_reference: null });
  });
  it("a document needs a reference", () => {
    expect(parseClaim(form({ evidence: "document" }))).toBeNull();
    expect(
      parseClaim(form({ evidence: "document", documentReference: "Ref 42" })),
    ).toEqual({ p_evidence: "document", p_document_reference: "Ref 42" });
  });
  it("rejects other evidence", () => {
    expect(parseClaim(form({ evidence: "trust me" }))).toBeNull();
  });
});

describe("parseDecision", () => {
  it("approval needs a method; labels need evidence", () => {
    expect(parseDecision(form({ decision: "approve" }))).toBeNull();
    expect(
      parseDecision(
        form({
          decision: "approve",
          method: "phone_call",
          labels: "identity_checked",
        }),
      ),
    ).toBeNull();
    expect(
      parseDecision(
        form({
          decision: "approve",
          method: "site_visit",
          labels: ["identity_checked", "identity_checked", "premises_visited"],
          evidence: "synthetic-ref",
        }),
      ),
    ).toEqual({
      p_decision: "approve",
      p_method: "site_visit",
      p_labels: ["identity_checked", "premises_visited"],
      p_evidence: "synthetic-ref",
      p_reason: null,
    });
  });
  it("rejects unknown labels and methods", () => {
    expect(
      parseDecision(form({ decision: "approve", method: "vibes" })),
    ).toBeNull();
    expect(
      parseDecision(
        form({
          decision: "approve",
          method: "phone_call",
          labels: "certified",
          evidence: "ref",
        }),
      ),
    ).toBeNull();
  });
  it("rejection needs a reason", () => {
    expect(parseDecision(form({ decision: "reject" }))).toBeNull();
    expect(
      parseDecision(form({ decision: "reject", reason: "Details unclear" }))
        ?.p_reason,
    ).toBe("Details unclear");
  });
});

describe("problemFrom", () => {
  it("maps codes to fixed keys and never passes database text through", () => {
    expect(problemFrom({ code: "42501", message: "anything" })).toBe(
      "not_allowed",
    );
    expect(problemFrom({ code: "22023" })).toBe("invalid_input");
    expect(problemFrom({ code: "P0001", message: "claim_pending" })).toBe(
      "claim_pending",
    );
    expect(
      problemFrom({ code: "P0001", message: "<script>alert(1)</script>" }),
    ).toBe("unavailable");
    expect(problemFrom({ code: "XX000", message: "boom" })).toBe("unavailable");
  });
  it("every key has copy", () => {
    for (const text of Object.values(PROBLEM_TEXT))
      expect(text.length).toBeGreaterThan(5);
  });
});

describe("parseId", () => {
  it("accepts only lower-case UUIDs", () => {
    expect(
      parseId(form({ id: "ca7c1000-0000-4000-8000-000000000001" }), "id"),
    ).not.toBeNull();
    expect(parseId(form({ id: "1 or 1=1" }), "id")).toBeNull();
  });
});

describe("sast", () => {
  it("shows UTC+2", async () => {
    const { sast } = await import("./forms");
    expect(sast("2026-11-10T22:15:00Z")).toBe("2026-11-11 00:15 SAST");
    expect(sast("not a date")).toBe("");
  });
});

describe("parsePage", () => {
  it("accepts 1 to 1,000 and defaults to 1", async () => {
    const { parsePage } = await import("./forms");
    expect(parsePage(null)).toBe(1);
    expect(parsePage("2")).toBe(2);
    expect(parsePage("1000")).toBe(1000);
    for (const bad of ["0", "1001", "-1", "1.5", "2;drop", ""])
      expect(parsePage(bad)).toBeNull();
  });
});

describe("O2 onboarding problem keys", () => {
  it("maps every new database key to fixed text", () => {
    for (const key of [
      "no_draft",
      "draft_incomplete",
      "consent_required",
      "invite_invalid",
      "invite_limit",
      "not_yet_available",
    ] as const) {
      expect(problemFrom({ code: "P0001", message: key })).toBe(key);
      expect(PROBLEM_TEXT[key].length).toBeGreaterThan(10);
    }
  });
});
