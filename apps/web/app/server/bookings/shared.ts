/**
 * Phase 3 bookings lane (planning/claude/24-phase-3-plan.md §5): shared
 * parsing, problem keys and formatting for the booking screens. Database
 * errors map to fixed keys; database text is never shown.
 */
import { field } from "../../auth/forms";

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type BookingProblem =
  | "invalid_input"
  | "not_allowed"
  | "not_found"
  | "offer_unavailable"
  | "too_soon"
  | "capacity_full"
  | "outside_hours"
  | "outside_area"
  | "wrong_state"
  | "request_lapsed"
  | "already_started"
  | "not_started"
  | "quote_expired"
  | "version_not_current"
  | "no_price"
  | "resource_unavailable"
  | "unavailable";

export const BOOKING_PROBLEM_TEXT: Record<BookingProblem, string> = {
  invalid_input: "Some details are missing or out of range. Check the form.",
  not_allowed: "You can't do that.",
  not_found: "We couldn't find that.",
  offer_unavailable: "This service can't be booked right now.",
  too_soon:
    "That time is too soon. The business needs time to accept and you need time to pay. Pick a later time.",
  capacity_full: "That time has just been taken. Pick another time.",
  outside_hours: "The business isn't open at that time.",
  outside_area: "That address is outside the area this business travels to.",
  wrong_state:
    "This booking can't do that any more. Refresh to see its status.",
  request_lapsed:
    "This request waited too long for an answer, so it has closed. The customer can ask again.",
  already_started: "This booking has already started.",
  not_started: "This job hasn't started yet.",
  quote_expired: "This quote has expired. Ask the business for a new one.",
  version_not_current:
    "There's a newer version of this quote. Look at the latest one.",
  no_price: "This booking has no price yet.",
  resource_unavailable: "That bay or team isn't available.",
  unavailable: "Something went wrong on our side. Try again in a minute.",
};

const KEYS = new Set<string>(Object.keys(BOOKING_PROBLEM_TEXT));

export function bookingProblem(error: {
  code?: string;
  message?: string;
}): BookingProblem {
  if (error.code === "42501") return "not_allowed";
  if (error.code === "22023") return "invalid_input";
  if (error.code === "P0001" && error.message && KEYS.has(error.message))
    return error.message as BookingProblem;
  return "unavailable";
}

/** R 1 234.50 from integer cents. */
export function rand(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "—";
  const r = minor / 100;
  return `R ${r.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const TZ = "Africa/Johannesburg";

/** "Fri 14 Nov, 09:30" in SAST. */
export function when(iso: string): string {
  return new Date(iso).toLocaleString("en-ZA", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "09:30" in SAST. */
export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Today's local date as YYYY-MM-DD. */
export function todayLocal(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD within the next 60 days, or null. */
export function parseDay(
  value: string | null,
  now = new Date(),
): string | null {
  if (value === null || !DAY.test(value)) return null;
  const today = todayLocal(now);
  const max = todayLocal(new Date(now.getTime() + 60 * 86_400_000));
  return value >= today && value <= max ? value : null;
}

/** The next n local dates from today. */
export function nextDays(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) =>
    todayLocal(new Date(now.getTime() + i * 86_400_000)),
  );
}

export function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00+02:00`).toLocaleDateString("en-ZA", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** An ISO timestamp the server produced (from a slot button), or null. */
export function parseInstant(form: FormData, name: string): string | null {
  const value = field(form, name);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export function parseText(
  form: FormData,
  name: string,
  min: number,
  max: number,
): string | null {
  const value = field(form, name).trim();
  if (value.length < min || value.length > max) return null;
  // eslint-disable-next-line no-control-regex -- reject control characters, as the database does
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export function parseOptionalText(
  form: FormData,
  name: string,
  max: number,
): string | null | false {
  const value = field(form, name).trim();
  if (value === "") return null;
  return parseText(form, name, 1, max) ?? false;
}

export function parseIntIn(
  form: FormData,
  name: string,
  min: number,
  max: number,
): number | null {
  const value = field(form, name).trim();
  if (!/^-?\d{1,9}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

/** "450.00" or "450" rand -> 45000 cents. */
export function parseRandToMinor(form: FormData, name: string): number | null {
  const value = field(form, name).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

export type BookingState =
  | "requested"
  | "declined"
  | "lapsed"
  | "awaiting_payment"
  | "payment_expired"
  | "confirmed"
  | "paid_after_expiry"
  | "cancelled"
  | "completed";

export const STATE_COPY: Record<
  BookingState,
  { label: string; tone: "ok" | "info" | "warn" | "err" }
> = {
  requested: { label: "Waiting for the business", tone: "info" },
  declined: { label: "Declined", tone: "err" },
  lapsed: { label: "No answer in time", tone: "warn" },
  awaiting_payment: { label: "Accepted: pay to confirm", tone: "warn" },
  payment_expired: { label: "Payment time ran out", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "ok" },
  paid_after_expiry: {
    label: "Paid late: choose a new time or a refund",
    tone: "warn",
  },
  cancelled: { label: "Cancelled", tone: "err" },
  completed: { label: "Done", tone: "ok" },
};

/**
 * The money lane's checkout entry point (Codex, plan §6 X1). Bookings links
 * to it with the hold id; Codex initialises Paystack from hold_snapshot.
 */
export function checkoutHref(holdId: string): string {
  return `/checkout/${holdId}`;
}

function pgInstant(text: string): string {
  let t = text.trim().replace(" ", "T");
  if (/[+-]\d{2}$/.test(t)) t += ":00";
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? text : new Date(ms).toISOString();
}

/** Postgres tstzrange text `["a","b")` -> { start, end } ISO instants. */
export function parseRange(range: string): { start: string; end: string } {
  const m = /^[[(]"?([^",]+)"?,"?([^",)\]]+)"?[)\]]$/.exec(range.trim());
  if (!m) return { start: range, end: range };
  return { start: pgInstant(m[1] ?? ""), end: pgInstant(m[2] ?? "") };
}

export interface DbError {
  code?: string;
  message?: string;
}
interface RpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: DbError | null }>;
}

/** A typed database function call: the caller states the row shape it expects. */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- the caller names the row shape
export async function rpc<T = unknown>(
  db: RpcClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<{ data: T | null; error: DbError | null }> {
  const result = await db.rpc(fn, args);
  return { data: result.data as T | null, error: result.error };
}
