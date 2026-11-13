import type { SignedIn } from "../auth/session.server";
import { throwRedirect, throwStatus } from "../auth/http.server";
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
  // Own membership metadata must be readable before org RLS admits data.
  // mfa_satisfied is the canonical DB decision, never a second Worker AAL rule.
  const result: { data: unknown; error: unknown } = await signedIn.supabase.rpc(
    "my_org_memberships",
    { p_org: org },
  );
  if (result.error !== null || !Array.isArray(result.data))
    throwStatus(503, signedIn.headers);
  if (result.data.length === 0) throwStatus(404, signedIn.headers);
  if (result.data.length !== 1) throwStatus(503, signedIn.headers);
  const value: unknown = result.data[0];
  if (typeof value !== "object" || value === null)
    throwStatus(503, signedIn.headers);
  const row = value as Record<string, unknown>;
  const id = row["id"],
    organisationId = row["organisation_id"],
    userId = row["user_id"],
    role = row["role"];
  if (
    typeof id !== "string" ||
    !UUID.test(id) ||
    typeof organisationId !== "string" ||
    organisationId.toLowerCase() !== org.toLowerCase() ||
    typeof userId !== "string" ||
    userId.toLowerCase() !== signedIn.user.id.toLowerCase() ||
    (role !== "owner" && role !== "manager" && role !== "staff") ||
    row["status"] !== "active" ||
    typeof row["mfa_satisfied"] !== "boolean"
  )
    throwStatus(503, signedIn.headers);
  if (!row["mfa_satisfied"])
    throwRedirect("/auth/mfa?returnTo=%2Fprovider", signedIn.headers);
  const membership: TeamMembership = {
    id,
    organisation_id: organisationId,
    user_id: userId,
    role,
    status: "active",
  };
  const organisation = await signedIn.supabase
    .from("organisations")
    .select("id, name, assign_mode, offer_anyone, staff_contact_visibility")
    .eq("id", org)
    .maybeSingle()
    .overrideTypes<TeamOrganisation | null, { merge: false }>();
  if (organisation.error !== null) throwStatus(503, signedIn.headers);
  if (organisation.data === null) throwStatus(404, signedIn.headers);
  return { membership, organisation: organisation.data };
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
