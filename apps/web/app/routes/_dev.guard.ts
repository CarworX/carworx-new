// Keeps /_dev/* out of production (D11). The pages hold no personal data and
// nothing dynamic, but they are a review tool, not product.
//
// Open when any of these holds:
// - Vite's dev server (`react-router dev`);
// - the request is for localhost / 127.0.0.1 / [::1] (`vite preview`, local
//   workerd), which a Cloudflare zone route never is;
// - the Worker has the var CARWORX_DEV_PAGES = "1". K2 sets it on staging
//   only, if Codex keeps the page there for K3's runs. Production never has it.
// Otherwise the route answers 404 like any unknown path.
// CARWORX_ENV = "production" closes the pages before every other rule (P-3),
// so neither a stray flag nor a dev build can open them there.

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function devPagesEnabled(
  request: Request,
  env: unknown,
  dev = import.meta.env.DEV,
): boolean {
  const vars =
    typeof env === "object" && env !== null
      ? (env as Record<string, unknown>)
      : {};
  if (vars["CARWORX_ENV"] === "production") return false;
  if (dev) return true;
  if (LOCAL.has(new URL(request.url).hostname)) return true;
  return vars["CARWORX_DEV_PAGES"] === "1";
}

/** Headers for every /_dev response: never indexed, never cached. */
export const DEV_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
} as const;
