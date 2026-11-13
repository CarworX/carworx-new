import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Call with the signed-in user's own request client. This does not authorize
 * membership/role; the caller must check that separately. No local AAL rule:
 * owners, uncovered roles and optional policies follow the canonical DB result.
 */
export async function orgMfaSatisfied(
  supabase: SupabaseClient,
  organisationId: string,
): Promise<boolean> {
  if (
    !/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(
      organisationId,
    )
  )
    return false;
  try {
    const result: { data: unknown; error: unknown } = await supabase.rpc(
      "org_mfa_satisfied",
      { p_org: organisationId },
    );
    return result.error === null && result.data === true;
  } catch {
    return false;
  }
}
