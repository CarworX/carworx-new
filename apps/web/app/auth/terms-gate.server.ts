import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { ServerConfig } from "../server/security/config";
import { readCookies } from "../server/security/cookies";
import { accessTokenFrom } from "../ui/site/viewer.server";

/** The consent page a signed-in person with no accepted terms is sent to. */
export const TERMS_PATH = "/auth/terms";

/**
 * Paths a person whose terms are pending may still open: the consent page
 * itself, sign-out, and the closing page (closing accounts are handled first).
 */
const TERMS_EXEMPT = /^\/(?:auth\/terms|auth\/sign-out|account\/closing)$/;

/**
 * accepted: the person has accepted the current terms.
 * pending: the terms were read and not accepted. Only this state blocks.
 * unknown: the status could not be read. The request goes on (fail open), so
 * a terms outage never locks people out of the site.
 */
export type TermsState = "accepted" | "pending" | "unknown";

/** Whether a request to this path may go on, given the terms state. */
export function termsGateAllows(pathname: string, state: TermsState): boolean {
  return state !== "pending" || TERMS_EXEMPT.test(pathname);
}

/**
 * Turns my_terms_status()'s result into a state. Anything unexpected is
 * "unknown", never "pending", so a malformed reply cannot block anyone.
 */
export function parseTermsStatus(result: {
  data: unknown;
  error: unknown;
}): TermsState {
  if (result.error !== null) return "unknown";
  const row: unknown = Array.isArray(result.data)
    ? result.data[0]
    : result.data;
  if (typeof row !== "object" || row === null) return "unknown";
  const accepted = (row as { accepted?: unknown }).accepted;
  if (accepted === true) return "accepted";
  if (accepted === false) return "pending";
  return "unknown";
}

/**
 * The signed-in person's terms state, through my_terms_status(). A thrown call
 * or an error is "unknown", logged, and the request goes on. The log carries
 * no account details.
 */
export async function readTermsState(
  supabase: SupabaseClient,
  onUnknown: (message: string) => void = (message) => {
    console.warn(message);
  },
): Promise<TermsState> {
  try {
    const result: { data: unknown; error: unknown } =
      await supabase.rpc("my_terms_status");
    const state = parseTermsStatus(result);
    if (state === "unknown") onUnknown("terms status unavailable");
    return state;
  } catch {
    onUnknown("terms status unavailable");
    return "unknown";
  }
}

/**
 * The same read for the root-level home page, from the request's access token
 * only (as readViewer does): verified by the RPC itself, no refresh and no
 * cookie written. No token means no gate to apply, so "unknown".
 */
export async function readTermsStateForRequest(
  request: Request,
  config: ServerConfig | undefined,
): Promise<TermsState> {
  if (config === undefined) return "unknown";
  const token = accessTokenFrom(readCookies(request));
  if (token === null) return "unknown";
  const db = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return readTermsState(db);
}
