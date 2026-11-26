/**
 * What the fines screens show, from the adapter's lookup (K3) and a payment's
 * status. Pure: routes read the data, this decides the screen and the words.
 * Money is in cents everywhere until it is formatted for display.
 */
import type { Fine } from "../server/fines/adapter";

export type LookupResult =
  { checkedAt: string; coverage: string[]; fines: Fine[] } | "unavailable";

/** One fine as a row on the list or detail. */
export interface FineRow {
  id: string;
  issuer: string;
  offence: string;
  issued: string;
  amountCents: number;
  /** The amount to pay: the discounted one while the discount runs. */
  payCents: number;
  discounted: boolean;
  payable: boolean;
  reasonNotPayable: string | null;
}

export type FinesView =
  | { kind: "unavailable" }
  | { kind: "none" }
  | {
      kind: "list";
      payable: FineRow[];
      notPayable: FineRow[];
      /** Every payable fine, paid at once. */
      totalCents: number;
      checkedAt: string;
      /** Only fines that cannot be paid here: a different path, not a checkout. */
      onlyNotPayable: boolean;
    };

const SAST_DATE = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  timeZone: "Africa/Johannesburg",
});

/** "2026-11-15" → "15 Nov" (the notice date, in SAST). */
export function shortDate(iso: string): string {
  const time = Date.parse(iso.length === 10 ? `${iso}T00:00:00+02:00` : iso);
  return Number.isNaN(time) ? iso : SAST_DATE.format(new Date(time));
}

const SAST_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Africa/Johannesburg",
});

/** "HH:mm" in SAST, for "Last checked today, 08:15 SAST". */
export function sastTime(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? "" : SAST_TIME.format(new Date(time));
}

/** Rand from cents, en-ZA, as on the spec: "R 450,00". */
export function rand(cents: number): string {
  const whole = (cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R ${whole}`;
}

function rowOf(fine: Fine): FineRow {
  const discounted =
    fine.discountedCents !== undefined &&
    fine.discountUntil !== undefined &&
    Date.parse(fine.discountUntil) > Date.now();
  return {
    id: fine.id,
    issuer: fine.issuer,
    offence: fine.offence,
    issued: fine.issuedAt,
    amountCents: fine.cents,
    payCents: discounted ? (fine.discountedCents ?? fine.cents) : fine.cents,
    discounted,
    payable: fine.payable,
    reasonNotPayable: fine.reasonNotPayable ?? null,
  };
}

/** The screen for a lookup result. */
export function finesView(result: LookupResult): FinesView {
  if (result === "unavailable") return { kind: "unavailable" };
  if (result.fines.length === 0) return { kind: "none" };
  const rows = result.fines.map(rowOf);
  const payable = rows.filter((r) => r.payable);
  const notPayable = rows.filter((r) => !r.payable);
  return {
    kind: "list",
    payable,
    notPayable,
    totalCents: payable.reduce((sum, r) => sum + r.payCents, 0),
    checkedAt: result.checkedAt,
    onlyNotPayable: payable.length === 0,
  };
}

/** One fine by id, from the lookup, or null if it is not on this person's ID. */
export function fineById(result: LookupResult, id: string): FineRow | null {
  if (result === "unavailable") return null;
  const fine = result.fines.find((f) => f.id === id);
  return fine ? rowOf(fine) : null;
}

/** What a payment's status says to show. */
export type PaymentView =
  | { kind: "awaiting" }
  | { kind: "paid"; receipt: string }
  | { kind: "stopped"; text: string };

/**
 * Only a settled payment (paid, with its receipt) is "paid". A checkout that
 * has not been confirmed by the issuer waits; the browser never marks it paid.
 */
export function paymentView(
  status: string,
  receipt: string | null,
): PaymentView {
  if (status === "paid" && receipt !== null) return { kind: "paid", receipt };
  if (status === "created" || status === "pending_issuer")
    return { kind: "awaiting" };
  if (status === "cancelled")
    return {
      kind: "stopped",
      text: "The checkout was cancelled. No payment was made.",
    };
  return { kind: "stopped", text: "No payment was confirmed." };
}
