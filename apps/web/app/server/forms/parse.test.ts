import { describe, expect, it } from "vitest";

import { email, parseDemand, parseEnquiry, parseSupport } from "./parse";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const ENQUIRY = {
  name: "Sam Sender",
  email: "Sam@Example.test",
  message: "Synthetic: do you do weekend washes?",
  consent: "on",
};

describe("email", () => {
  it("lower-cases and accepts a plain address", () => {
    expect(email(form({ email: " Sam@Example.TEST " }))).toBe(
      "sam@example.test",
    );
  });
  it.each([
    "",
    "sam",
    "sam@",
    "@x.test",
    "sam@x",
    "sam@x..test",
    "s am@x.test",
  ])("refuses %j", (value) => {
    expect(email(form({ email: value }))).toBeNull();
  });
});

describe("parseEnquiry", () => {
  it("accepts a complete form", () => {
    expect(parseEnquiry(form(ENQUIRY))).toEqual({
      ok: true,
      value: {
        name: "Sam Sender",
        email: "sam@example.test",
        message: ENQUIRY.message,
      },
    });
  });
  it("needs the consent box ticked", () => {
    expect(parseEnquiry(form({ ...ENQUIRY, consent: "" }))).toEqual({
      ok: false,
      problem: "consent_required",
    });
    expect(parseEnquiry(form({ ...ENQUIRY, consent: "true" }))).toEqual({
      ok: false,
      problem: "consent_required",
    });
  });
  it("bounds every field", () => {
    for (const bad of [
      { name: "S" },
      { name: "x".repeat(81) },
      { name: "Sam\u0007" },
      { message: "short" },
      { message: "x".repeat(1001) },
      { email: "nope" },
    ])
      expect(parseEnquiry(form({ ...ENQUIRY, ...bad })).ok).toBe(false);
  });
  it("keeps line breaks in the message", () => {
    const r = parseEnquiry(
      form({ ...ENQUIRY, message: "Line one here\r\nLine two" }),
    );
    expect(r.ok && r.value.message).toBe("Line one here\nLine two");
  });
});

describe("parseDemand", () => {
  const DEMAND = {
    email: "dana@example.test",
    category: "wash-and-detailing",
    province: "gauteng",
    consent: "on",
  };
  it("accepts a known service and province", () => {
    expect(parseDemand(form(DEMAND)).ok).toBe(true);
  });
  it("refuses unknown values and missing consent", () => {
    expect(parseDemand(form({ ...DEMAND, category: "fines" })).ok).toBe(false);
    expect(parseDemand(form({ ...DEMAND, province: "atlantis" })).ok).toBe(
      false,
    );
    expect(parseDemand(form({ ...DEMAND, consent: "" }))).toEqual({
      ok: false,
      problem: "consent_required",
    });
  });
  it("never reads a point or place text", () => {
    const r = parseDemand(
      form({ ...DEMAND, lat: "-26.1", lng: "28.0", area: "Sandton" }),
    );
    expect(r.ok && Object.keys(r.value).sort()).toEqual([
      "category",
      "email",
      "province",
    ]);
  });
});

describe("parseSupport", () => {
  const SUPPORT = {
    email: "sue@example.test",
    topic: "privacy_request",
    message: "Synthetic: please delete my demand request.",
  };
  it("accepts a known topic", () => {
    expect(parseSupport(form(SUPPORT)).ok).toBe(true);
  });
  it("refuses an unknown topic or a short message", () => {
    expect(parseSupport(form({ ...SUPPORT, topic: "billing" })).ok).toBe(false);
    expect(parseSupport(form({ ...SUPPORT, message: "hi" })).ok).toBe(false);
  });
});
