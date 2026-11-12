/**
 * Redirect allowlist for `returnTo` / `next` parameters (PLAN §4).
 *
 * Only same-origin paths under these prefixes are accepted; anything else
 * (absolute URLs, protocol-relative `//host`, backslashes, encoded slashes,
 * control characters, other schemes, auth pages) falls back to a fixed page.
 */
export const DEFAULT_AFTER_SIGN_IN = "/account";

const ALLOWED = [
  /^\/$/,
  /^\/account(?:[/?#]|$)/,
  /^\/admin(?:[/?#]|$)/,
  /^\/org\/[^/?#]+(?:[?#]|$)/,
  /^\/provider(?:\/apply)?(?:[?#]|$)/,
  /^\/provider\/claim\/[0-9a-f-]{36}(?:[?#]|$)/i,
  /^\/provider\/get-listed\/(?:business|service|location|about|check|submitted)$/,
  /^\/provider\/setup\/[a-z-]+\/[a-z-]+$/,
  // Invite secrets stay in a short-lived HttpOnly cookie, never in returnTo.
  /^\/join$/,
];

export function safeReturnTo(
  value: unknown,
  appOrigin: string,
  fallback: string = DEFAULT_AFTER_SIGN_IN,
): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) {
    return fallback;
  }
  // Reject before URL parsing normalises them away.
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    // eslint-disable-next-line no-control-regex -- control characters are the point
    /[\\\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }
  if (/%(?:2f|5c|00)/i.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, appOrigin);
  } catch {
    return fallback;
  }
  if (url.origin !== appOrigin) return fallback;
  const path = `${url.pathname}${url.search}${url.hash}`;
  return ALLOWED.some((re) => re.test(path)) ? path : fallback;
}

/** Absolute URL on the app origin, for links Supabase puts in emails. */
export function appUrl(appOrigin: string, path: string): string {
  return new URL(path, appOrigin).toString();
}
