/**
 * Form parsing for provider and admin pages (P2-4 + P2-7, Claude 21). Plain
 * bounds that mirror the database checks, so a bad form gets a clear message
 * before any call. The database re-checks everything; these are not the
 * security boundary. Messages never echo input.
 */
import { field } from "../../auth/forms";

export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Services a provider can apply for. Slugs match supabase/seed.sql; an integration test checks them. */
export const SERVICE_OPTIONS = [
  { slug: "wash", label: "Wash & Detailing" },
  { slug: "service", label: "Mechanical service" },
  { slug: "paint", label: "Panel and paint" },
  { slug: "electrical", label: "Auto electrical" },
  { slug: "mobile-repair", label: "Mobile mechanic" },
  { slug: "glass", label: "Glass Repair & Replacement" },
  { slug: "tyres", label: "Tyres & Wheel Alignment" },
] as const;

/** D-023 review methods, recorded with every approval. */
export const REVIEW_METHODS = [
  { value: "phone_call", label: "Phone call" },
  { value: "video_call", label: "Video call" },
  { value: "document_check", label: "Documents checked" },
  { value: "registry_check", label: "Business registry checked" },
  { value: "site_visit", label: "Site visit" },
] as const;

/** Claude 17 §3 labels, as verifications.method values. */
export const LABELS = [
  { value: "identity_checked", label: "Identity checked" },
  { value: "business_details_checked", label: "Business details checked" },
  { value: "premises_visited", label: "Premises visited" },
] as const;

export type Problem =
  | "invalid_input"
  | "not_allowed"
  | "application_pending"
  | "not_submitted"
  | "not_draft"
  | "not_live"
  | "not_suspended"
  | "not_claimable"
  | "already_member"
  | "email_unconfirmed"
  | "free_mail_domain"
  | "claim_pending"
  | "claim_not_pending"
  | "claim_not_disputable"
  | "dispute_closed"
  | "claim_superseded"
  | "transfer_disputed"
  | "unavailable";

export const PROBLEM_TEXT: Record<Problem, string> = {
  invalid_input: "Some details are missing or out of range. Check the form.",
  not_allowed: "You can't do that.",
  application_pending:
    "You already have an application waiting for review. We'll look at that one first.",
  not_submitted: "This listing isn't waiting for review any more.",
  not_draft: "This listing is already waiting for review.",
  not_live: "Only a live listing can be suspended.",
  not_suspended: "This listing isn't suspended.",
  not_claimable: "Only live listings can be claimed.",
  already_member: "You already help run this business.",
  email_unconfirmed: "Confirm your email address first.",
  free_mail_domain:
    "That's a personal email address. Use your business email, or send a document instead.",
  claim_pending: "You already have a claim waiting for review on this listing.",
  claim_not_pending: "This claim isn't waiting for a decision.",
  claim_not_disputable: "This claim can't be disputed now.",
  dispute_closed: "This dispute has already been resolved.",
  claim_superseded:
    "A later transfer has replaced this one, so it can't be disputed or reversed.",
  transfer_disputed:
    "This business's last transfer is under dispute. Resolve that dispute first.",
  unavailable: "Something went wrong on our side. Try again in a minute.",
};

const KEYS = new Set<string>(Object.keys(PROBLEM_TEXT));

/** Maps a PostgREST error to a fixed problem key. Never passes database text through. */
export function problemFrom(error: {
  code?: string;
  message?: string;
}): Problem {
  if (error.code === "42501") return "not_allowed";
  if (error.code === "22023") return "invalid_input";
  if (error.code === "P0001" && error.message && KEYS.has(error.message))
    return error.message as Problem;
  return "unavailable";
}

function text(form: FormData, name: string, min: number, max: number) {
  const value = field(form, name).trim();
  if (
    value.length < min ||
    value.length > max ||
    // eslint-disable-next-line no-control-regex -- reject control characters, as the database does
    /[\u0000-\u001f\u007f]/.test(value)
  )
    return null;
  return value;
}

function number(form: FormData, name: string): number | null {
  const raw = field(form, name).trim();
  if (!/^-?\d{1,3}(\.\d{1,7})?$/.test(raw)) return null;
  return Number(raw);
}

export interface Application {
  p_business_name: string;
  p_service_slug: string;
  p_mode: "fixed" | "mobile";
  p_metro: string;
  p_description: string;
  p_address: string | null;
  p_lat: number;
  p_lng: number;
  p_radius_km: number | null;
}

export function parseApplication(form: FormData): Application | null {
  const name = text(form, "businessName", 2, 160);
  const service = field(form, "service");
  const mode = field(form, "mode");
  const metro = text(form, "metro", 2, 120);
  const description = text(form, "description", 10, 2000);
  const lat = number(form, "latitude");
  const lng = number(form, "longitude");
  if (
    name === null ||
    metro === null ||
    description === null ||
    !SERVICE_OPTIONS.some((s) => s.slug === service) ||
    (mode !== "fixed" && mode !== "mobile") ||
    lat === null ||
    lng === null ||
    lat < -35 ||
    lat > -22 ||
    lng < 16 ||
    lng > 33 ||
    field(form, "confirm") !== "on"
  )
    return null;
  if (mode === "fixed") {
    const address = text(form, "address", 5, 300);
    if (address === null) return null;
    return {
      p_business_name: name,
      p_service_slug: service,
      p_mode: mode,
      p_metro: metro,
      p_description: description,
      p_address: address,
      p_lat: lat,
      p_lng: lng,
      p_radius_km: null,
    };
  }
  const radius = field(form, "radiusKm").trim();
  if (!/^\d{1,3}$/.test(radius)) return null;
  const km = Number(radius);
  if (km < 1 || km > 100) return null;
  return {
    p_business_name: name,
    p_service_slug: service,
    p_mode: mode,
    p_metro: metro,
    p_description: description,
    p_address: null,
    p_lat: lat,
    p_lng: lng,
    p_radius_km: km,
  };
}

export function parseClaim(form: FormData): {
  p_evidence: "business_email" | "document";
  p_document_reference: string | null;
} | null {
  const evidence = field(form, "evidence");
  if (evidence === "business_email")
    return { p_evidence: evidence, p_document_reference: null };
  if (evidence !== "document") return null;
  const reference = text(form, "documentReference", 3, 200);
  return reference === null
    ? null
    : { p_evidence: evidence, p_document_reference: reference };
}

export function parseId(form: FormData, name: string): string | null {
  const id = field(form, name);
  return UUID.test(id) ? id : null;
}

export function parseReason(
  form: FormData,
  name: string,
  min: number,
  max: number,
): string | null {
  return text(form, name, min, max);
}

export interface Decision {
  p_decision: "approve" | "reject";
  p_method: string | null;
  p_labels: string[];
  p_evidence: string | null;
  p_reason: string | null;
}

export function parseDecision(form: FormData): Decision | null {
  const decision = field(form, "decision");
  if (decision === "reject") {
    const reason = text(form, "reason", 5, 500);
    return reason === null
      ? null
      : {
          p_decision: decision,
          p_method: null,
          p_labels: [],
          p_evidence: null,
          p_reason: reason,
        };
  }
  if (decision !== "approve") return null;
  const method = field(form, "method");
  if (!REVIEW_METHODS.some((m) => m.value === method)) return null;
  const labels = form
    .getAll("labels")
    .filter((v): v is string => typeof v === "string");
  if (
    labels.length > LABELS.length ||
    !labels.every((l) => LABELS.some((x) => x.value === l))
  )
    return null;
  const evidence = labels.length > 0 ? text(form, "evidence", 3, 200) : null;
  if (labels.length > 0 && evidence === null) return null;
  return {
    p_decision: decision,
    p_method: method,
    p_labels: [...new Set(labels)],
    p_evidence: evidence,
    p_reason: null,
  };
}

/** A timestamp as SAST (UTC+2, no daylight saving), e.g. "2026-11-10 22:15 SAST". */
export function sast(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return `${new Date(t + 2 * 3600_000).toISOString().slice(0, 16).replace("T", " ")} SAST`;
}
