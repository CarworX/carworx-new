/**
 * CarworX's invoice to a provider, which is also their monthly statement
 * (planning/claude/25 §3a (b), D-054, D-096).
 *
 * VAT (OQ-E1, pending the accountant): every VAT element is driven by the
 * invoice's own snapshot (vatRegistered, set when it was issued from the one
 * billing switch). Off: a plain "Invoice" with no VAT line and no VAT words.
 * On: "Tax invoice" with the s20(4) content: CarworX's VAT number, the
 * provider as recipient, serial number, date, description, value, VAT and
 * total. The provider's address and VAT number are not collected yet; with
 * VAT on they are shown as still to be added, so nothing is hidden.
 */
import { calendarDay, clean, money, monthYear } from "../mail-templates/format";
import { LEGAL } from "../mail-templates/frame";
import { DocumentWriter } from "./layout";

export const INVOICE_REF = /^CXI-[0-9]{6,12}$/;

export interface InvoiceLine {
  date: string;
  label: string;
  grossMinor: number;
  feeMinor: number;
}

export interface Invoice {
  ref: string;
  business: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  lines: InvoiceLine[];
  grossMinor: number;
  totalMinor: number;
  vat: { number: string; rateBp: number; vatMinor: number } | null;
}

interface Raw {
  ref?: unknown;
  business?: unknown;
  period_start?: unknown;
  period_end?: unknown;
  issued_at?: unknown;
  lines?: unknown;
  gross_minor?: unknown;
  total_minor?: unknown;
  vat_registered?: unknown;
  vat_number?: unknown;
  vat_rate_bp?: unknown;
  vat_minor?: unknown;
}
interface RawLine {
  date?: unknown;
  label?: unknown;
  gross_minor?: unknown;
  fee_minor?: unknown;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function int(v: unknown): number | null {
  const x = typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v;
  return typeof x === "number" && Number.isSafeInteger(x) ? x : null;
}

/** Validate provider_invoice's JSON; null unless complete and consistent. */
export function parseInvoice(input: unknown): Invoice | null {
  if (!isRecord(input)) return null;
  const raw: Raw = input;
  const ref = typeof raw.ref === "string" ? raw.ref : "";
  const total = int(raw.total_minor);
  const gross = int(raw.gross_minor);
  const business =
    typeof raw.business === "string" ? clean(raw.business, 120) : "";
  const start = typeof raw.period_start === "string" ? raw.period_start : "";
  const end = typeof raw.period_end === "string" ? raw.period_end : "";
  const issued =
    typeof raw.issued_at === "string" &&
    !Number.isNaN(Date.parse(raw.issued_at))
      ? raw.issued_at
      : null;
  if (
    !INVOICE_REF.test(ref) ||
    total === null ||
    total <= 0 ||
    gross === null ||
    business === "" ||
    !DAY.test(start) ||
    !DAY.test(end) ||
    issued === null ||
    !Array.isArray(raw.lines) ||
    raw.lines.length === 0
  )
    return null;
  const lines: InvoiceLine[] = [];
  for (const item of raw.lines as unknown[]) {
    const l: RawLine | null = isRecord(item) ? item : null;
    const g = l === null ? null : int(l.gross_minor);
    const f = l === null ? null : int(l.fee_minor);
    if (
      l === null ||
      typeof l.date !== "string" ||
      !DAY.test(l.date) ||
      typeof l.label !== "string" ||
      g === null ||
      f === null ||
      f < 0
    )
      return null;
    lines.push({
      date: l.date,
      label: clean(l.label, 80),
      grossMinor: g,
      feeMinor: f,
    });
  }
  if (lines.reduce((s, l) => s + l.feeMinor, 0) !== total) return null;
  let vat: Invoice["vat"] = null;
  if (raw.vat_registered === true) {
    const rate = int(raw.vat_rate_bp);
    const amount = int(raw.vat_minor);
    if (
      typeof raw.vat_number !== "string" ||
      !/^4\d{9}$/.test(raw.vat_number) ||
      rate === null ||
      amount === null ||
      amount < 0 ||
      amount >= total
    )
      return null;
    vat = { number: raw.vat_number, rateBp: rate, vatMinor: amount };
  } else if (raw.vat_registered !== false) return null;
  return {
    ref,
    business,
    periodStart: start,
    periodEnd: end,
    issuedAt: issued,
    lines,
    grossMinor: gross,
    totalMinor: total,
    vat,
  };
}

/** "2026-11-01" to "November 2026". */
export const monthName = monthYear;
const shortDate = calendarDay;
function issuedDate(iso: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
  }).format(new Date(iso));
  return shortDate(day);
}

/** The words "tax invoice" appear only when the invoice's snapshot has VAT on. */
export function invoiceTitle(i: Invoice): string {
  return i.vat === null ? "Invoice" : "Tax invoice";
}

export function renderInvoicePdf(i: Invoice): Uint8Array<ArrayBuffer> {
  const title = invoiceTitle(i);
  const doc = new DocumentWriter(
    i.ref,
    `CarworX ${title.toLowerCase()} ${i.ref}`,
  );
  doc.eyebrow(`${title} and monthly statement`);
  doc.heading(
    `${money(i.totalMinor)} CarworX fee`,
    `${monthName(i.periodStart)}, ${i.business}.`,
  );
  doc.paragraph(
    `This is CarworX's fee for bookings paid in the app in ${monthName(i.periodStart)}: 10% of each payment, capped at R500 per job. It was taken through the payment split when each customer paid, so there is nothing to pay now.`,
  );
  const supplier = [
    `${LEGAL.name}, registration ${LEGAL.registration}`,
    LEGAL.address,
  ];
  const facts: { label: string; value: string }[] = [
    { label: title === "Invoice" ? "Invoice no." : "Serial no.", value: i.ref },
    { label: "Date issued", value: issuedDate(i.issuedAt) },
    {
      label: "Period",
      value: `${shortDate(i.periodStart)} to ${shortDate(i.periodEnd)}`,
    },
    { label: "From", value: supplier.join(" · ") },
  ];
  if (i.vat !== null) facts.push({ label: "VAT no.", value: i.vat.number });
  facts.push({ label: "To", value: i.business });
  if (i.vat !== null) {
    facts.push({
      label: "Their address",
      value: "[to be added before VAT invoices start]",
    });
    facts.push({
      label: "Their VAT no.",
      value: "[if registered; to be added]",
    });
  }
  const rows = i.lines.map((l) => ({
    label: `${shortDate(l.date)} · ${l.label} (customer paid ${money(l.grossMinor)})`,
    amount: money(l.feeMinor),
  }));
  const after =
    i.vat === null
      ? []
      : [
          {
            label: `Value excluding VAT`,
            amount: money(i.totalMinor - i.vat.vatMinor),
          },
          {
            label: `VAT at ${String(i.vat.rateBp / 100)}%`,
            amount: money(i.vat.vatMinor),
          },
        ];
  doc.ticket({
    title: `${title} · ${String(i.lines.length)} job${i.lines.length === 1 ? "" : "s"}`,
    ref: i.ref,
    rows,
    total: {
      label: i.vat === null ? "CarworX fee" : "Total including VAT",
      amount: money(i.totalMinor),
    },
    after: [
      ...after,
      { label: "Customers paid you in total", amount: money(i.grossMinor) },
    ],
    facts,
  });
  doc.paragraph(
    "Download every invoice and statement from Invoices in your CarworX business account. Keep them for your records; CarworX keeps them for 5 years.",
    { size: 9.5 },
  );
  return doc.finish();
}
