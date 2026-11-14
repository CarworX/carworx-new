import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InvoiceList } from "../../ui/InvoiceList";
import { render } from "../mail-templates/templates";
import { SAMPLES, SAMPLE_ORIGIN } from "../mail-templates/samples";
import { invoiceTitle, parseInvoice, renderInvoicePdf } from "./invoice";
import { parseInvoiceList } from "./invoice-list";
import { invoiceResponse, type InvoiceCaller } from "./invoice-route.server";
import { issueMonthlyInvoices, purgeOldInvoices } from "./jobs.server";
import type { RetentionClient } from "../retention/run";

// Synthetic data only.
const RAW = {
  ref: "CXI-000042",
  business: "Gleam Mobile Valet (synthetic)",
  period_start: "2026-10-01",
  period_end: "2026-10-31",
  issued_at: "2026-11-01T00:17:00+00:00",
  lines: [
    {
      date: "2026-10-03",
      label: "Full valet",
      gross_minor: 83_000,
      fee_minor: 8_300,
    },
    {
      date: "2026-10-21",
      label: "Engine rebuild",
      gross_minor: 900_000,
      fee_minor: 50_000,
    },
  ],
  jobs: 2,
  gross_minor: 983_000,
  total_minor: 58_300,
  vat_registered: false,
  vat_number: null,
  vat_rate_bp: null,
  vat_minor: 0,
};
const VAT_ON = {
  ...RAW,
  vat_registered: true,
  vat_number: "4123456789",
  vat_rate_bp: 1500,
  vat_minor: 7_604,
};

function pageText(pdf: Uint8Array): string {
  const raw = Array.from(pdf, (b) => String.fromCharCode(b)).join("");
  const out: string[] = [];
  for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g))
    out.push(
      (m[1] ?? "")
        .replace(/\\([0-7]{3})/g, (_, o: string) =>
          String.fromCharCode(parseInt(o, 8)),
        )
        .replace(/\\(.)/g, "$1"),
    );
  return out.join(" ");
}
function text(raw: unknown): string {
  const i = parseInvoice(raw);
  if (i === null) throw new Error("fixture");
  return pageText(renderInvoicePdf(i));
}

describe("invoice VAT switch (OQ-E1, pending the accountant)", () => {
  it("off (the default): a plain invoice, no VAT words or lines", () => {
    const t = text(RAW);
    expect(t).toContain("Invoice and monthly statement".toUpperCase());
    expect(t).not.toMatch(/tax invoice/i);
    expect(t).not.toMatch(/\bVAT\b/);
    expect(t).toContain("CarworX fee");
    expect(t).toContain("R583");
    expect(t).toContain("CXI-000042");
    expect(t).toContain("nothing to pay");
    expect(t).toContain("1 Oct 2026 to 31 Oct 2026");
  });

  it("on: a tax invoice with the s20(4) content", () => {
    const t = text(VAT_ON);
    expect(invoiceTitle(parseInvoice(VAT_ON) ?? (null as never))).toBe(
      "Tax invoice",
    );
    expect(t).toContain("TAX INVOICE AND MONTHLY STATEMENT");
    expect(t).toContain("VAT no. 4123456789");
    expect(t).toContain("Serial no. CXI-000042");
    expect(t).toContain("Date issued 1 Nov 2026"); // SAST date
    expect(t).toContain("VAT at 15% R76.04");
    expect(t).toContain("Value excluding VAT R506.96");
    expect(t).toContain("Total including VAT R583");
    expect(t).toContain("Gleam Mobile Valet (synthetic)");
  });

  it("follows the invoice's own snapshot, so an issued invoice never changes", () => {
    // The renderer has no global switch: the same row renders the same way.
    expect(renderInvoicePdf(parseInvoice(RAW) ?? (null as never))).toEqual(
      renderInvoicePdf(parseInvoice(RAW) ?? (null as never)),
    );
  });

  it("lists each job with its date, service, customer payment and fee", () => {
    const t = text(RAW);
    expect(t).toContain("3 Oct 2026 · Full valet (customer paid R830) R83");
    expect(t).toContain(
      "21 Oct 2026 · Engine rebuild (customer paid R9 000) R500",
    );
  });
});

describe("parseInvoice", () => {
  it("rejects incomplete or inconsistent invoices", () => {
    expect(parseInvoice(null)).toBeNull();
    expect(parseInvoice({ ...RAW, ref: "CX-000042" })).toBeNull();
    expect(parseInvoice({ ...RAW, total_minor: 1 })).toBeNull(); // lines don't add up
    expect(parseInvoice({ ...RAW, lines: [] })).toBeNull();
    expect(parseInvoice({ ...RAW, vat_registered: "yes" })).toBeNull();
    expect(parseInvoice({ ...VAT_ON, vat_number: "123" })).toBeNull();
    expect(parseInvoice({ ...VAT_ON, vat_minor: 58_300 })).toBeNull();
    expect(parseInvoice({ ...RAW, period_start: "Oct" })).toBeNull();
  });
});

function caller(result: { data: unknown; error: unknown }): InvoiceCaller & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    headers: new Headers(),
    invoice: (ref) => {
      calls.push(ref);
      return Promise.resolve(result);
    },
  };
}

describe("GET /provider/invoices/:ref.pdf access", () => {
  it("serves an owner or manager a private, no-store download", async () => {
    const res = await invoiceResponse(
      "CXI-000042.pdf",
      caller({ data: RAW, error: null }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="carworx-invoice-CXI-000042.pdf"',
    );
  });

  it("404s staff, other businesses, customers and the gate being off alike", async () => {
    // provider_invoice returns null in every one of those cases.
    const res = await invoiceResponse(
      "CXI-000042.pdf",
      caller({ data: null, error: null }),
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("404s malformed or mismatched references", async () => {
    for (const file of [
      "CXI-42.pdf",
      "CX-1A2B3C4D5E6F.pdf",
      "CXI-000042",
      undefined,
    ]) {
      const c = caller({ data: RAW, error: null });
      expect((await invoiceResponse(file, c)).status).toBe(404);
      expect(c.calls).toEqual([]);
    }
    expect(
      (
        await invoiceResponse(
          "CXI-000043.pdf",
          caller({ data: RAW, error: null }),
        )
      ).status,
    ).toBe(404);
  });

  it("is 503 when the database fails", async () => {
    expect(
      (
        await invoiceResponse(
          "CXI-000042.pdf",
          caller({ data: null, error: {} }),
        )
      ).status,
    ).toBe(503);
  });
});

describe("/provider/invoices list", () => {
  const LIST = {
    enabled: true,
    invoices: [
      {
        ref: "CXI-000042",
        business: "Gleam (synthetic)",
        period_start: "2026-10-01",
        jobs: 2,
        total_minor: 58_300,
        issued_at: "2026-11-01T00:17:00Z",
      },
      {
        ref: "CXI-000007",
        business: "Gleam (synthetic)",
        period_start: "2026-09-01",
        jobs: 1,
        total_minor: 8_300,
        issued_at: "2026-10-01T00:17:00Z",
      },
    ],
  };

  it("is hidden (null, so the page 404s) while the gate is off", () => {
    expect(parseInvoiceList({ enabled: false, invoices: [] })).toBeNull();
    expect(parseInvoiceList(null)).toBeNull();
    expect(
      parseInvoiceList({ enabled: true, invoices: [{ ref: "x" }] }),
    ).toBeNull();
  });

  it("lists each month with a Download link to its PDF", () => {
    const rows = parseInvoiceList(LIST);
    expect(rows).toHaveLength(2);
    const html = renderToStaticMarkup(<InvoiceList invoices={rows ?? []} />);
    expect(html).toContain("October 2026");
    expect(html).toContain('href="/provider/invoices/CXI-000042.pdf"');
    expect(html).toContain('href="/provider/invoices/CXI-000007.pdf"');
    expect(html.match(/Download PDF/g)).toHaveLength(2);
    expect(html).toContain("R583");
  });

  it("explains an empty list", () => {
    const html = renderToStaticMarkup(<InvoiceList invoices={[]} />);
    expect(html).toContain("No invoices yet");
  });
});

describe("monthly statement email (OQ-E3)", () => {
  const r = render(SAMPLES.provider_statement, SAMPLE_ORIGIN);
  it("says what was taken and that nothing is due", () => {
    expect(r.subject).toBe("Your CarworX statement for October 2026");
    expect(r.text).toContain("R1 046 CarworX fee, already taken.");
    expect(r.text).toContain("nothing to pay");
    expect(r.html).toContain(
      "https://carworx.app/provider/invoices/CXI-000042.pdf",
    );
    expect(r.html).not.toMatch(/tax invoice/i);
  });
  it("refuses bad months and amounts", () => {
    const s = SAMPLES.provider_statement as Extract<
      typeof SAMPLES.provider_statement,
      { kind: "provider_statement" }
    >;
    expect(() =>
      render({ ...s, month: "2026-13-01" }, SAMPLE_ORIGIN),
    ).toThrow();
    expect(() => render({ ...s, feeMinor: 0 }, SAMPLE_ORIGIN)).toThrow();
    expect(() => render({ ...s, jobs: 0 }, SAMPLE_ORIGIN)).toThrow();
  });
});

describe("daily invoice jobs", () => {
  function fake(rows: unknown[]) {
    const sqls: string[] = [];
    let ended = false;
    const client: RetentionClient = {
      connect: () => Promise.resolve(),
      query: (sql: string) => {
        sqls.push(sql);
        return Promise.resolve({ rows });
      },
      end: () => {
        ended = true;
        return Promise.resolve();
      },
    };
    return { sqls, ended: () => ended, make: () => Promise.resolve(client) };
  }

  it("issue and purge return counts only and always close", async () => {
    const f = fake([{ count: 3 }]);
    expect(await issueMonthlyInvoices({ connectionString: "x" }, f.make)).toBe(
      3,
    );
    expect(f.sqls).toEqual([
      "select private.issue_monthly_invoices() as count",
    ]);
    expect(f.ended()).toBe(true);
    const g = fake([{ count: 0 }]);
    expect(await purgeOldInvoices({ connectionString: "x" }, g.make)).toBe(0);
    expect(g.sqls).toEqual(["select private.purge_old_invoices() as count"]);
  });

  it("fail with a fixed reason only", async () => {
    await expect(
      issueMonthlyInvoices(undefined, fake([]).make),
    ).rejects.toThrow("invoice_issue_unavailable");
    await expect(
      purgeOldInvoices({ connectionString: "x" }, fake([{ count: "1" }]).make),
    ).rejects.toThrow("invoice_retention_unavailable");
  });
});
