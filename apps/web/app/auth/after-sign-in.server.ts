import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where a person goes after signing in with no safe returnTo (B-14):
 * anyone with an active business membership goes to their business
 * (/provider); everyone else goes to the home page. A failed lookup goes to
 * the home page, never to a page that errors without a membership.
 */
export async function signedInDestination(
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase
    .from("memberships")
    .select("id")
    .eq("status", "active")
    .limit(1)
    .overrideTypes<{ id: string }[], { merge: false }>();
  if (error !== null) return "/";
  return data.length > 0 ? "/provider" : "/";
}
