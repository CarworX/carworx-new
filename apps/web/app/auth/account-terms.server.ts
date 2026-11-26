import type { AuthRequest } from "./session.server";

export const ACCOUNT_TERMS_VERSION = "account-terms-v1";
export const GOOGLE_TERMS_COOKIE = "__Host-cx-google-terms";

export async function recordAccountTerms(auth: AuthRequest, version: unknown) {
  if (version !== ACCOUNT_TERMS_VERSION) return true;
  const { error } = await auth.supabase.rpc("accept_account_terms", {
    p_version: version,
  });
  return error === null;
}
