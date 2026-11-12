/**
 * Parsing for the visitor forms (P2-5, Claude 22 §2). Plain bounds that mirror
 * the database checks, so a bad form gets a clear message before any call.
 * The database re-checks everything; this is not the security boundary.
 * Messages never echo input.
 */
import { field, isTicked } from "../../auth/forms";
import { CATEGORIES } from "../../catalogue/taxonomy";

/** The privacy notice version each consent row records. */
export const NOTICE_VERSION = "privacy-2026-11-11";

export const PROVINCES = [
  { value: "eastern-cape", label: "Eastern Cape" },
  { value: "free-state", label: "Free State" },
  { value: "gauteng", label: "Gauteng" },
  { value: "kwazulu-natal", label: "KwaZulu-Natal" },
  { value: "limpopo", label: "Limpopo" },
  { value: "mpumalanga", label: "Mpumalanga" },
  { value: "north-west", label: "North West" },
  { value: "northern-cape", label: "Northern Cape" },
  { value: "western-cape", label: "Western Cape" },
] as const;

export const TOPICS = [
  { value: "listing_problem", label: "A problem with a listing" },
  { value: "account", label: "My account" },
  {
    value: "privacy_request",
    label: "My personal information (see, correct, delete or withdraw consent)",
  },
  { value: "other", label: "Something else" },
] as const;

export type Parsed<T> =
  | { ok: true; value: T }
  | { ok: false; problem: "invalid_input" | "consent_required" };

// eslint-disable-next-line no-control-regex -- reject control characters, as the database does
const CONTROL = /[\u0000-\u001f\u007f]/;

function line(form: FormData, name: string, min: number, max: number) {
  const value = field(form, name).trim();
  if (value.length < min || value.length > max || CONTROL.test(value))
    return null;
  return value;
}

/** CRLF and CR become LF; line breaks are kept, other controls refused. */
function multiline(form: FormData, name: string, min: number, max: number) {
  const value = field(form, name)
    .replace(/\r\n?/g, "\n")
    .replace(/^[\s]+|[\s]+$/g, "");
  if (
    value.length < min ||
    value.length > max ||
    CONTROL.test(value.replace(/\n/g, ""))
  )
    return null;
  return value;
}

/** The same shape the database accepts (private.clean_email). */
export function email(form: FormData): string | null {
  const value = field(form, "email").trim().toLowerCase();
  if (
    value.length > 254 ||
    // eslint-disable-next-line no-control-regex -- same refusal as the database
    !/^[^@\s\u0000-\u001f\u007f]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/.test(
      value,
    ) ||
    value.includes("..")
  )
    return null;
  return value;
}

export interface Enquiry {
  name: string;
  email: string;
  message: string;
}
export function parseEnquiry(form: FormData): Parsed<Enquiry> {
  const name = line(form, "name", 2, 80);
  const address = email(form);
  const message = multiline(form, "message", 10, 1000);
  if (name === null || address === null || message === null)
    return { ok: false, problem: "invalid_input" };
  if (!isTicked(form, "consent"))
    return { ok: false, problem: "consent_required" };
  return { ok: true, value: { name, email: address, message } };
}

export interface Demand {
  email: string;
  category: string;
  province: string;
}
export function parseDemand(form: FormData): Parsed<Demand> {
  const address = email(form);
  const category = field(form, "category");
  const province = field(form, "province");
  if (
    address === null ||
    !CATEGORIES.some((c) => c.slug === category) ||
    !PROVINCES.some((p) => p.value === province)
  )
    return { ok: false, problem: "invalid_input" };
  if (!isTicked(form, "consent"))
    return { ok: false, problem: "consent_required" };
  return { ok: true, value: { email: address, category, province } };
}

export interface Support {
  email: string;
  topic: string;
  message: string;
}
export function parseSupport(form: FormData): Parsed<Support> {
  const address = email(form);
  const topic = field(form, "topic");
  const message = multiline(form, "message", 10, 2000);
  if (
    address === null ||
    message === null ||
    !TOPICS.some((t) => t.value === topic)
  )
    return { ok: false, problem: "invalid_input" };
  return { ok: true, value: { email: address, topic, message } };
}
