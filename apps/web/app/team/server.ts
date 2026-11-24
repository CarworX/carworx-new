import type { SignedIn } from "../auth/session.server";
import { throwStatus } from "../auth/http.server";
import { SERVICE_OPTIONS, UUID } from "../server/providers/forms";
import type { TeamRole } from "./forms";

export interface TeamMembership {
  id: string;
  organisation_id: string;
  user_id: string;
  role: TeamRole;
  status: "active" | "revoked";
}
export interface TeamOrganisation {
  id: string;
  name: string;
  assign_mode: "customer" | "business";
  offer_anyone: boolean;
  staff_contact_visibility: "phone" | "first_name" | "booking_only";
}
export interface StaffProfile {
  membership_id: string;
  first_name: string | null;
  service_slugs: string[];
  days: number[];
}
export interface TeamInvite {
  id: string;
  role: "manager" | "staff";
  email: string | null;
  expires_at: string;
  used_at: string | null;
}

export function privateHeaders(headers: Headers) {
  headers.set("Cache-Control", "private, no-store");
  headers.set("Referrer-Policy", "no-referrer");
  return headers;
}

/** Every read uses the caller's JWT. Membership is checked again per request. */
export async function loadTeam(signedIn: SignedIn, org: string | null) {
  privateHeaders(signedIn.headers);
  if (org === null || !UUID.test(org)) throwStatus(404, signedIn.headers);
  const membership = await signedIn.supabase
    .from("memberships")
    .select("id, organisation_id, user_id, role, status")
    .eq("organisation_id", org)
    .eq("user_id", signedIn.user.id)
    .eq("status", "active")
    .maybeSingle()
    .overrideTypes<TeamMembership | null, { merge: false }>();
  if (membership.error !== null) throwStatus(503, signedIn.headers);
  if (membership.data === null) throwStatus(404, signedIn.headers);
  const organisation = await signedIn.supabase
    .from("organisations")
    .select("id, name, assign_mode, offer_anyone, staff_contact_visibility")
    .eq("id", org)
    .maybeSingle()
    .overrideTypes<TeamOrganisation | null, { merge: false }>();
  if (organisation.error !== null) throwStatus(503, signedIn.headers);
  if (organisation.data === null) throwStatus(404, signedIn.headers);
  return { membership: membership.data, organisation: organisation.data };
}

export async function teamServices(signedIn: SignedIn, org: string) {
  const selected = await signedIn.supabase
    .from("listing_services")
    .select("service_slug")
    .eq("organisation_id", org)
    .overrideTypes<{ service_slug: string }[], { merge: false }>();
  if (selected.error !== null) throwStatus(503, signedIn.headers);
  const slugs = new Set(selected.data.map((s) => s.service_slug));
  // Names come from the public catalogue list. The services table itself is
  // admin-only under RLS, so a staff member could never read it.
  return SERVICE_OPTIONS.filter((o) => slugs.has(o.slug))
    .map((o) => ({ slug: o.slug, name: o.label }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface TeamMemberRow {
  id: string;
  user_id: string;
  role: TeamRole;
  display_name: string | null;
}

/** Treat the RPC response as untrusted: keep only the four fields, checked. */
export function readTeamMembers(value: unknown): TeamMemberRow[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const rows: TeamMemberRow[] = [];
  for (const item of value) {
    const c: unknown = item;
    if (
      typeof c !== "object" ||
      c === null ||
      !("id" in c) ||
      typeof c.id !== "string" ||
      !UUID.test(c.id) ||
      !("user_id" in c) ||
      typeof c.user_id !== "string" ||
      !UUID.test(c.user_id) ||
      !("role" in c) ||
      (c.role !== "owner" && c.role !== "manager" && c.role !== "staff") ||
      !("display_name" in c) ||
      (c.display_name !== null &&
        (typeof c.display_name !== "string" || c.display_name.length > 120))
    )
      return null;
    rows.push({
      id: c.id,
      user_id: c.user_id,
      role: c.role,
      display_name: c.display_name,
    });
  }
  return rows;
}

/** Active members with their display names; members of that business only. */
export async function teamMembers(signedIn: SignedIn, org: string) {
  const result: { data: unknown; error: unknown } = await signedIn.supabase.rpc(
    "team_members",
    { p_org: org },
  );
  const rows = result.error === null ? readTeamMembers(result.data) : null;
  if (rows === null) throwStatus(503, signedIn.headers);
  return rows;
}
