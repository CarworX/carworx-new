import { describe, expect, it, vi } from "vitest";

import { winAnsi, widthOf, wrap } from "./pdf";
import {
  NOT_A_TAX_INVOICE,
  parseReceipt,
  renderReceiptPdf,
  type Receipt,
} from "./receipt";
import { receiptResponse, type ReceiptCaller } from "./route.server";

// Synthetic data only.
const RAW = {
  ref: "CX-1A2B3C4D5E6F",
  paid_at: "2026-11-14T12:32:00+00:00",
  amount_minor: 83_000,
  currency: "ZAR",
  mode: "test",
  starts_at: "2026-11-15T07:00:00+00:00",
  state: "confirmed",
  business: "Gleam Mobile Valet (synthetic)",
  area: "Rosebank",
  service: "Full valet",
  quote_version: null,
  quote_lines: null,
  travel_minor: 18_000,
  refunded_minor: 0,
};

/** The text drawn on the page: the PDF's literal strings, unescaped. */
function pageText(pdf: Uint8Array): string {
  const raw = Array.from(pdf, (b) => String.fromCharCode(b)).join("");
  const out: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g)) {
    out.push(
      (m[1] ?? "")
        .replace(/\\([0-7]{3})/g, (_, o: string) =>
          String.fromCharCode(parseInt(o, 8)),
        )
        .replace(/\\(.)/g, "$1"),
    );
  }
  // Wrapped lines break at spaces, so a space rejoins sentences.
  return out.join(" ");
}

function receipt(over: Partial<typeof RAW> = {}): Receipt {
  const r = parseReceipt({ ...RAW, ...over });
  if (r === null) throw new Error("fixture");
  return r;
}

function caller(
  result: { data: unknown; error: unknown } | Error,
): ReceiptCaller & { calls: string[] } {
  const calls: string[] = [];
  const headers = new Headers();
  headers.append("Set-Cookie", "sb-session=refreshed; Path=/; HttpOnly");
  return {
    calls,
    headers,
    receipt: vi.fn((ref: string) => {
      calls.push(ref);
      return result instanceof Error
        ? Promise.reject(result)
        : Promise.resolve(result);
    }),
  };
}

describe("receipt wording (OQ-E2: receipt only)", () => {
  const text = pageText(renderReceiptPdf(receipt()));

  it("says in words that it is not a tax invoice", () => {
    expect(NOT_A_TAX_INVOICE).toBe(
      "This is a payment receipt, not a tax invoice.",
    );
    expect(text).toContain(NOT_A_TAX_INVOICE);
    expect(text).toContain("ask them for a tax invoice");
    expect(text).toContain("does not issue tax invoices for businesses");
  });

  it("never calls itself a tax invoice or shows VAT", () => {
    const withoutDisclaimers = text
      .replace(NOT_A_TAX_INVOICE, "")
      .replace(/ask them for a tax invoice/, "")
      .replace(/does not issue tax invoices for businesses/, "");
    expect(withoutDisclaimers).not.toMatch(/tax invoice/i);
    expect(text).not.toMatch(/\bVAT (no|number|@|15)/i);
  });

  it("names the business as supplier and shows lines, total and facts", () => {
    expect(text).toContain("Gleam Mobile Valet (synthetic) is the supplier");
    expect(text).toContain("Full valet");
    expect(text).toContain("R650");
    expect(text).toContain("Travel (mobile service)");
    expect(text).toContain("R180");
    expect(text).toContain("Total paid");
    expect(text).toContain("R830 paid");
    expect(text).toContain("Sat 14 Nov 2026, 14:32"); // SAST, not UTC
    expect(text).toContain("CX-1A2B3C4D5E6F");
    expect(text).toContain("CarworX never holds the money");
    expect(text).toContain("Page 1 of 1");
  });

  it("marks test payments", () => {
    expect(text).toContain("Test payment: no real money moved.");
    expect(pageText(renderReceiptPdf(receipt({ mode: "live" })))).not.toContain(
      "Test payment",
    );
  });

  it("shows refunds", () => {
    const t = pageText(renderReceiptPdf(receipt({ refunded_minor: 10_000 })));
    expect(t).toContain("Refunded");
    expect(t).toContain("R730");
  });

  it("is a well-formed PDF with a correct cross-reference table", () => {
    const pdf = renderReceiptPdf(receipt());
    const raw = Array.from(pdf, (b) => String.fromCharCode(b)).join("");
    expect(raw.startsWith("%PDF-1.4\n")).toBe(true);
    expect(raw.endsWith("%%EOF\n")).toBe(true);
    const xref = Number(/startxref\n(\d+)\n/.exec(raw)?.[1]);
    expect(raw.slice(xref, xref + 4)).toBe("xref");
    const entries = raw
      .slice(xref)
      .split("\n")
      .filter((l) => / 00000 n $/.test(l));
    entries.forEach((e, i) => {
      const at = Number(e.slice(0, 10));
      expect(raw.slice(at, at + String(i + 1).length + 6)).toBe(
        `${String(i + 1)} 0 obj`,
      );
    });
    // Same input, same bytes: nothing time-dependent is embedded.
    expect(renderReceiptPdf(receipt())).toEqual(pdf);
  });
});

describe("parseReceipt", () => {
  it("uses quote lines only when they add up to the amount paid", () => {
    const lines = [
      { label: "Brake pads (front)", amount_minor: 50_000 },
      { label: "Labour", amount_minor: 15_000 },
    ];
    const ok = receipt({
      quote_version: 2 as never,
      quote_lines: lines as never,
      travel_minor: 18_000,
    });
    expect(ok.lines.map((l) => l.label)).toEqual([
      "Brake pads (front)",
      "Labour",
      "Travel (mobile service)",
    ]);
    const off = receipt({
      quote_version: 2 as never,
      quote_lines: [{ label: "Brakes", amount_minor: 1 }] as never,
    });
    expect(off.lines[0]).toEqual({
      label: "Full valet (quote v2)",
      amountMinor: 65_000,
    });
    for (const r of [ok, off])
      expect(r.lines.reduce((s, l) => s + l.amountMinor, 0)).toBe(83_000);
  });

  it("rejects incomplete or inconsistent data", () => {
    expect(parseReceipt(null)).toBeNull();
    expect(parseReceipt("x")).toBeNull();
    expect(parseReceipt({ ...RAW, ref: "CX-abc" })).toBeNull();
    expect(parseReceipt({ ...RAW, amount_minor: 0 })).toBeNull();
    expect(parseReceipt({ ...RAW, travel_minor: 90_000 })).toBeNull();
    expect(parseReceipt({ ...RAW, refunded_minor: 90_000 })).toBeNull();
    expect(parseReceipt({ ...RAW, currency: "USD" })).toBeNull();
    expect(parseReceipt({ ...RAW, paid_at: "not a date" })).toBeNull();
    expect(parseReceipt({ ...RAW, business: "  " })).toBeNull();
  });

  it("accepts bigint amounts sent as strings", () => {
    expect(parseReceipt({ ...RAW, amount_minor: "83000" })?.amountMinor).toBe(
      83_000,
    );
  });

  it("cleans names: no control or bidi characters reach the page", () => {
    const rlo = String.fromCharCode(0x202e);
    const nul = String.fromCharCode(0);
    const r = receipt({ business: `Evil${rlo}Co${nul} (synthetic)` });
    expect(r.business).toBe("Evil Co (synthetic)");
    const t = pageText(renderReceiptPdf(r));
    expect(t.includes(rlo)).toBe(false);
    expect(Array.from(t).some((c) => c.charCodeAt(0) < 32)).toBe(false);
  });

  it("escapes PDF string syntax in user text", () => {
    const r = receipt({ business: "Brackets (a) \\ b) Tj ET" });
    const raw = Array.from(renderReceiptPdf(r), (b) =>
      String.fromCharCode(b),
    ).join("");
    expect(raw).toContain("Brackets \\(a\\) \\\\ b\\) Tj ET");
    expect(pageText(renderReceiptPdf(r))).toContain("Brackets (a) \\ b) Tj ET");
  });
});

describe("GET /receipts/:ref.pdf access", () => {
  it("serves the owner's receipt as a private, no-store download", async () => {
    const c = caller({ data: RAW, error: null });
    const res = await receiptResponse("CX-1A2B3C4D5E6F.pdf", c);
    expect(res.status).toBe(200);
    expect(c.calls).toEqual(["CX-1A2B3C4D5E6F"]);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="carworx-receipt-CX-1A2B3C4D5E6F.pdf"',
    );
    expect(res.headers.get("Set-Cookie")).toContain("sb-session=refreshed");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(pageText(body)).toContain(NOT_A_TAX_INVOICE);
  });

  it("gives anyone else the same 404 as an unknown reference", async () => {
    // customer_receipt returns null for another customer, the business, an
    // admin, an unpaid payment and an unknown reference alike.
    const res = await receiptResponse(
      "CX-1A2B3C4D5E6F.pdf",
      caller({ data: null, error: null }),
    );
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("404s malformed references without querying", async () => {
    for (const file of [
      undefined,
      "",
      "CX-1A2B3C4D5E6F",
      "CX-1a2b3c4d5e6f.pdf",
      "CX-1A2B3C4D5E6.pdf",
      "../CX-1A2B3C4D5E6F.pdf",
      "CXI-000000000001.pdf",
      "cx_1a2b3c4d5e6f00000000000000000000.pdf",
    ]) {
      const c = caller({ data: RAW, error: null });
      const res = await receiptResponse(file, c);
      expect(res.status).toBe(404);
      expect(c.calls).toEqual([]);
    }
  });

  it("404s when the data does not belong to the reference asked for", async () => {
    const res = await receiptResponse(
      "CX-000000000000.pdf",
      caller({ data: RAW, error: null }),
    );
    // RAW's ref is CX-1A2B3C4D5E6F; parse accepts it, but the route must
    // not serve a different receipt than the one in the URL.
    expect(res.status).toBe(404);
  });

  it("is 503, not 404, when the database fails", async () => {
    expect(
      (
        await receiptResponse(
          "CX-1A2B3C4D5E6F.pdf",
          caller({ data: null, error: { code: "57014" } }),
        )
      ).status,
    ).toBe(503);
    expect(
      (await receiptResponse("CX-1A2B3C4D5E6F.pdf", caller(new Error("down"))))
        .status,
    ).toBe(503);
  });
});

describe("layout keeps text on the page", () => {
  it("wraps a long business name in the subtitle (Codex review on #120)", () => {
    const long =
      "Johannesburg Automotive Repairs and Complete Vehicle Maintenance Specialists";
    const raw = Array.from(renderReceiptPdf(receipt({ business: long })), (b) =>
      String.fromCharCode(b),
    ).join("");
    // Every text run starts inside the margins and fits before the right edge.
    let runs = 0;
    for (const m of raw.matchAll(
      /\/(F\d) ([\d.]+) Tf ([\d.]+) [\d.]+ Td \(((?:\\.|[^\\)])*)\) Tj/g,
    )) {
      const font = m[1] === "F1" ? "sans" : m[1] === "F2" ? "bold" : "mono";
      const size = Number(m[2]);
      const x = Number(m[3]);
      const t = (m[4] ?? "").replace(/\\(.)/g, "$1");
      expect(x + widthOf(t, font, size)).toBeLessThanOrEqual(595.28 - 47);
      runs++;
    }
    expect(runs).toBeGreaterThan(20);
    expect(pageText(renderReceiptPdf(receipt({ business: long })))).toContain(
      "Vehicle Maintenance Specialists",
    );
  });
});

describe("pdf text helpers", () => {
  it("maps text to WinAnsi and replaces what the fonts cannot draw", () => {
    expect(winAnsi("Café −R5 • ok")).toBe("Café -R5 \u0095 ok");
    expect(winAnsi("名前")).toBe("??");
  });

  it("wraps within the width and cuts over-long words", () => {
    const lines = wrap("a ".repeat(200) + "x".repeat(300), "sans", 11, 200);
    for (const l of lines)
      expect(widthOf(l, "sans", 11)).toBeLessThanOrEqual(200);
    expect(lines.join("").replace(/ /g, "")).toBe(
      "a".repeat(200) + "x".repeat(300),
    );
  });
});
