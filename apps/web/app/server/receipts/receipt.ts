/**
 * Customer receipt (a), planning/claude/25 §3a and D-096.
 *
 * A payment receipt, never a tax invoice (OQ-E2): the business is the
 * supplier and, if it is VAT-registered, issues its own tax invoice. CarworX
 * does not issue tax invoices on providers' behalf. The PDF says so in words.
 */
import {
  clean,
  dateTime,
  dateTimeYear,
  day,
  money,
} from "../mail-templates/format";
import { DocumentWriter, type TicketRow } from "./layout";

export const RECEIPT_REF = /^CX-[0-9A-F]{12}$/;

/** The exact words that make the receipt's status plain. Tests pin them. */
export const NOT_A_TAX_INVOICE =
  "This is a payment receipt, not a tax invoice.";

export interface Receipt {
  ref: string;
  paidAt: string;
  startsAt: string;
  amountMinor: number;
  refundedMinor: number;
  business: string;
  area: string | null;
  lines: { label: string; amountMinor: number }[];
  testMode: boolean;
}

/** customer_receipt's JSON, every field still unchecked. */
interface Raw {
  ref?: unknown;
  paid_at?: unknown;
  amount_minor?: unknown;
  currency?: unknown;
  mode?: unknown;
  starts_at?: unknown;
  business?: unknown;
  area?: unknown;
  service?: unknown;
  quote_version?: unknown;
  quote_lines?: unknown;
  travel_minor?: unknown;
  refunded_minor?: unknown;
}
interface RawLine {
  label?: unknown;
  amount_minor?: unknown;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function int(v: unknown): number | null {
  const x = typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : v;
  return typeof x === "number" && Number.isSafeInteger(x) ? x : null;
}
function iso(v: unknown): string | null {
  return typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null;
}

/**
 * Validate the customer_receipt RPC's JSON. Null when it is not a complete,
 * paid receipt. Lines always add up to the amount paid: quote lines are used
 * only when they (plus travel) match it, otherwise one service line does.
 */
export function parseReceipt(input: unknown): Receipt | null {
  if (!isRecord(input)) return null;
  const raw: Raw = input;
  const ref = typeof raw.ref === "string" ? raw.ref : "";
  const amount = int(raw.amount_minor);
  const travel = int(raw.travel_minor) ?? 0;
  const refunded = int(raw.refunded_minor) ?? 0;
  const paidAt = iso(raw.paid_at);
  const startsAt = iso(raw.starts_at);
  const business =
    typeof raw.business === "string" ? clean(raw.business, 80) : "";
  if (
    !RECEIPT_REF.test(ref) ||
    amount === null ||
    amount <= 0 ||
    travel < 0 ||
    travel > amount ||
    refunded < 0 ||
    refunded > amount ||
    paidAt === null ||
    startsAt === null ||
    business === "" ||
    raw.currency !== "ZAR"
  )
    return null;
  const service =
    typeof raw.service === "string" && raw.service.trim() !== ""
      ? clean(raw.service, 80)
      : "Booked service";
  const version = int(raw.quote_version);
  const quoted: { label: string; amountMinor: number }[] = [];
  if (Array.isArray(raw.quote_lines)) {
    for (const item of raw.quote_lines as unknown[]) {
      const l: RawLine | null = isRecord(item) ? item : null;
      const minor = l === null ? null : int(l.amount_minor);
      if (
        l === null ||
        typeof l.label !== "string" ||
        minor === null ||
        minor < 0
      ) {
        quoted.length = 0;
        break;
      }
      quoted.push({ label: clean(l.label, 120), amountMinor: minor });
    }
  }
  const quotedSum = quoted.reduce((s, l) => s + l.amountMinor, 0);
  const lines =
    quoted.length > 0 && quotedSum + travel === amount
      ? quoted
      : [
          {
            label:
              version === null
                ? service
                : `${service} (quote v${String(version)})`,
            amountMinor: amount - travel,
          },
        ];
  if (travel > 0)
    lines.push({ label: "Travel (mobile service)", amountMinor: travel });
  return {
    ref,
    paidAt,
    startsAt,
    amountMinor: amount,
    refundedMinor: refunded,
    business,
    area:
      typeof raw.area === "string" && raw.area.trim() !== ""
        ? clean(raw.area, 60)
        : null,
    lines,
    testMode: raw.mode !== "live",
  };
}

/** The receipt as an A4 PDF in the CarworX document style. */
export function renderReceiptPdf(r: Receipt): Uint8Array<ArrayBuffer> {
  const doc = new DocumentWriter(r.ref, `CarworX payment receipt ${r.ref}`);
  doc.eyebrow("Payment receipt");
  doc.heading(
    `${money(r.amountMinor)} paid`,
    `to ${r.business}, for ${day(r.startsAt)}.`,
  );
  doc.paragraph(NOT_A_TAX_INVOICE, { font: "bold", size: 12 });
  doc.paragraph(
    `${r.business} is the supplier of this service. If they are registered for VAT, ask them for a tax invoice. CarworX is the booking platform and does not issue tax invoices for businesses.`,
  );
  if (r.testMode)
    doc.paragraph("Test payment: no real money moved.", {
      font: "bold",
      size: 10,
    });
  const after: TicketRow[] =
    r.refundedMinor > 0
      ? [
          { label: "Refunded", amount: money(-r.refundedMinor) },
          { label: "Net paid", amount: money(r.amountMinor - r.refundedMinor) },
        ]
      : [];
  doc.ticket({
    title: "Receipt",
    ref: r.ref,
    rows: r.lines.map((l) => ({
      label: l.label,
      amount: money(l.amountMinor),
    })),
    total: { label: "Total paid", amount: money(r.amountMinor) },
    after,
    facts: [
      { label: "Paid", value: dateTimeYear(r.paidAt) },
      {
        label: "Method",
        value: r.testMode
          ? "Online payment through Paystack (test mode)"
          : "Online payment through Paystack",
      },
      {
        label: "Paid to",
        value: r.area === null ? r.business : `${r.business}, ${r.area}`,
      },
      { label: "Booking", value: dateTime(r.startsAt) },
    ],
  });
  doc.paragraph(
    "The payment went straight to the business through our payment partner, Paystack. CarworX never holds the money or stores your card details. Keep this receipt for your records.",
    { size: 9.5 },
  );
  return doc.finish();
}
