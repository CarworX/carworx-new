/**
 * Escaping and CarworX formatting for transactional email.
 * Pure functions: no I/O, no logging, safe in the Worker and in Node.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape text for HTML element content and quoted attribute values. */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** Remove control characters and collapse whitespace in user-supplied text. */
export function clean(value: string, max = 120): string {
  const flat = Array.from(value, (c) =>
    isInvisible(c.codePointAt(0) ?? 0) ? " " : c,
  )
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** C0/C1 controls, zero-width marks, line separators and bidi overrides. */
function isInvisible(code: number): boolean {
  return (
    code <= 0x1f ||
    (code >= 0x7f && code <= 0x9f) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

/**
 * A link is accepted only when it is https (or a Supabase Go-template link,
 * used to generate the Auth templates) and on the expected origin.
 */
export function safeLink(link: string, origin: string): string {
  if (link.startsWith("{{ .SiteURL }}/")) return link;
  const url = new URL(link);
  const expected = new URL(origin);
  if (url.origin !== expected.origin) throw new Error("mail_link_origin");
  if (url.protocol !== "https:" && !isLoopback(url.hostname))
    throw new Error("mail_link_protocol");
  return url.href;
}

function isLoopback(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** R2 430 from cents: a space as the thousands separator, cents only when needed. */
export function money(minor: number): string {
  if (!Number.isInteger(minor)) throw new Error("mail_money");
  const sign = minor < 0 ? "−" : "";
  const abs = Math.abs(minor);
  const rand = Math.floor(abs / 100);
  const cents = abs % 100;
  const whole = String(rand).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}R${whole}${cents === 0 ? "" : `.${String(cents).padStart(2, "0")}`}`;
}

const TZ = "Africa/Johannesburg";
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pick(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("mail_date");
  const p: Record<string, string> = {};
  for (const { type, value } of parts.formatToParts(date)) p[type] = value;
  return p as Record<
    "weekday" | "day" | "month" | "year" | "hour" | "minute",
    string
  >;
}

/** 14:32 (SAST). */
export function time(iso: string): string {
  const p = pick(iso);
  return `${p.hour}:${p.minute}`;
}

/** Sat 31 Oct, 09:00 (SAST). */
export function dateTime(iso: string): string {
  const p = pick(iso);
  return `${p.weekday} ${p.day} ${p.month}, ${p.hour}:${p.minute}`;
}

/** Fri 14 Nov 2026, 14:32 (SAST), for receipts. */
export function dateTimeYear(iso: string): string {
  const p = pick(iso);
  return `${p.weekday} ${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`;
}

/** Sat 31 Oct (SAST). */
export function day(iso: string): string {
  const p = pick(iso);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "1 hour", "24 hours", "7 days", "15 minutes". */
export function duration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60)
    return `${String(minutes)} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${String(hours)} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${String(days)} days`;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "2026-11-01" (a calendar date, no time zone) to "November 2026". */
export function monthYear(day: string): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(day);
  const name = m === null ? undefined : MONTHS[Number(m[2]) - 1];
  if (m === null || name === undefined) throw new Error("mail_date");
  return `${name} ${m[1] ?? ""}`;
}

/** "2026-11-04" (a calendar date, no time zone) to "4 Nov 2026". */
export function calendarDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const name = m === null ? undefined : MONTHS[Number(m[2]) - 1];
  if (m === null || name === undefined) throw new Error("mail_date");
  return `${String(Number(m[3]))} ${name.slice(0, 3)} ${m[1] ?? ""}`;
}
