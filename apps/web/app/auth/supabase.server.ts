import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { ServerConfig } from "../server/security/config";
import {
  SESSION_COOKIE,
  readCookies,
  serializeAppCookie,
} from "../server/security/cookies";

export interface RequestSupabase {
  supabase: SupabaseClient;
  /** Set-Cookie headers the auth client produced; return them with the response. */
  headers: Headers;
}

/**
 * One Supabase client per request, acting as the signed-in user (publishable
 * key + the user's JWT, so RLS applies). The session lives only in
 * `__Host-cx-auth*` cookies (HttpOnly; the browser never sees tokens), and
 * every cookie write goes through `serializeAppCookie`.
 */
export function createRequestSupabase(
  request: Request,
  config: ServerConfig,
): RequestSupabase {
  const headers = new Headers();
  const supabase = createServerClient(
    config.supabaseUrl,
    config.supabasePublishableKey,
    {
      cookieOptions: { name: SESSION_COOKIE },
      cookies: {
        getAll() {
          return readCookies(request).filter((c) =>
            c.name.startsWith(SESSION_COOKIE),
          );
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            headers.append(
              "Set-Cookie",
              serializeAppCookie(name, value, {
                maxAge: options.maxAge ?? 400 * 24 * 60 * 60,
              }),
            );
          }
        },
      },
      global: {
        // Workers: no keep-alive pooling across requests is assumed.
        fetch: (input, init) => fetch(input, init),
      },
    },
  );
  return { supabase, headers };
}
