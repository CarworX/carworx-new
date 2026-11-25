import { createClient } from "@supabase/supabase-js";

import type { ServerConfig } from "../../server/security/config";
import { readCookies, SESSION_COOKIE } from "../../server/security/cookies";
import { firstNameOf, initialsOf, type Viewer } from "./viewer";

const MAX_TOKEN = 8192;

/**
 * The session's access token, read from the cookie the Auth client writes.
 * Chunked cookies (name.0, name.1, …) are joined in order; a "base64-" prefix
 * means the JSON is base64url-encoded. Returns null for anything else.
 */
export function accessTokenFrom(
  cookies: readonly { name: string; value: string }[],
): string | null {
  const parts = cookies
    .flatMap((c) => {
      if (c.name === SESSION_COOKIE) return [{ index: 0, value: c.value }];
      const match = new RegExp(`^${SESSION_COOKIE}\\.(\\d+)$`).exec(c.name);
      return match?.[1] === undefined
        ? []
        : [{ index: Number(match[1]), value: c.value }];
    })
    .sort((a, b) => a.index - b.index);
  if (parts.length === 0) return null;
  let raw = parts.map((p) => p.value).join("");
  try {
    if (raw.startsWith("base64-")) {
      const base64 = raw.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
      raw = new TextDecoder().decode(bytes);
    }
    const token: unknown = (JSON.parse(raw) as { access_token?: unknown })
      .access_token;
    if (typeof token !== "string" || token.length > MAX_TOKEN) return null;
    return token.split(".").length === 3 ? token : null;
  } catch {
    return null;
  }
}

/**
 * The header's view of the signed-in person, for the root loader.
 *
 * Read only, by design: the access token is verified here (signature and
 * expiry, through getClaims with the token passed in), never refreshed, and
 * no cookie is written. So this can't rotate a refresh token or sign anyone
 * out. An expired token reads as signed out until the next page that refreshes
 * the session. Nothing that makes a decision reads this value; pages keep their
 * own checks.
 */
export async function readViewer(
  request: Request,
  config: ServerConfig | undefined,
): Promise<Viewer | null> {
  if (config === undefined) return null;
  const token = accessTokenFrom(readCookies(request));
  if (token === null) return null;
  const db = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const verified = await db.auth.getClaims(token);
  if (verified.error !== null || verified.data === null) return null;
  const claims = verified.data.claims as Record<string, unknown>;
  const sub = claims["sub"];
  if (typeof sub !== "string") return null;
  const email = typeof claims["email"] === "string" ? claims["email"] : null;
  const meta = claims["user_metadata"];
  const metaName =
    typeof meta === "object" && meta !== null
      ? ([
          (meta as Record<string, unknown>)["full_name"],
          (meta as Record<string, unknown>)["name"],
        ].find((v): v is string => typeof v === "string" && v.trim() !== "") ??
        null)
      : null;
  // Profile display name first (RLS: the person's own row), then Google's name.
  const profile = await db
    .from("profiles")
    .select("display_name")
    .eq("id", sub)
    .limit(1)
    .overrideTypes<{ display_name: string | null }[], { merge: false }>();
  const profileName =
    profile.error === null ? (profile.data[0]?.display_name ?? null) : null;
  const name =
    [profileName, metaName].find(
      (v): v is string => typeof v === "string" && v.trim() !== "",
    ) ?? null;
  return {
    firstName: name === null ? null : firstNameOf(name) || null,
    initials: initialsOf(name, email),
  };
}
