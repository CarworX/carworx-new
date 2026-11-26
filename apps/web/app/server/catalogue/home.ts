/**
 * What the browse-first home page (D-097) shows: live counts per design
 * category and a few live businesses. Public data only, through the same
 * anon projection as the category pages (`listing_public`), so the page can
 * stay `public, max-age=300`. No location is used: the home list never asks
 * for one and is never empty because of it.
 */
import { CATEGORIES } from "../../catalogue/taxonomy";
import type { CatalogueConfig, PublicListing } from "./public";

const COLUMNS =
  "public_id,display_name,description,metro,mode,service_slug,service_name,category_slug,category_name,public_address,public_latitude,public_longitude,verification_labels,cover_key,rating_avg,rating_count";
/** How many live listings the home considers before picking its cards. */
const POOL = 60;
export const HOME_CARDS = 6;

export interface HomeCatalogue {
  /** Live listings per design category slug (subcategories included). */
  counts: Record<string, number>;
  total: number;
  listings: PublicListing[];
}

function endpoint(config: CatalogueConfig, query: URLSearchParams): URL {
  const url = new URL("/rest/v1/listing_public", config.supabaseUrl);
  url.search = query.toString();
  return url;
}

function headers(config: CatalogueConfig, extra: Record<string, string> = {}) {
  return {
    apikey: config.supabasePublishableKey,
    Authorization: `Bearer ${config.supabasePublishableKey}`,
    Accept: "application/json",
    ...extra,
  };
}

/** Exact row count from PostgREST's Content-Range ("0-0/12" or "*\/0"). */
async function count(
  config: CatalogueConfig,
  slugs: readonly string[] | null,
  send: typeof fetch,
): Promise<number> {
  const query = new URLSearchParams({ select: "public_id" });
  if (slugs) query.set("category_slug", `in.(${slugs.join(",")})`);
  const response = await send(endpoint(config, query), {
    method: "HEAD",
    headers: headers(config, {
      Prefer: "count=exact",
      "Range-Unit": "items",
      Range: "0-0",
    }),
    redirect: "manual",
    signal: AbortSignal.timeout(3_000),
  });
  await response.body?.cancel();
  const total = /\/(\d+)$/.exec(response.headers.get("Content-Range") ?? "");
  if (!response.ok || !total) throw new Error("count unavailable");
  return Number(total[1]);
}

/**
 * Checked businesses first (more checks, then name), so the first cards are
 * the ones CarworX has verified most. Stable for a given catalogue.
 */
export function pickCards(rows: PublicListing[], n = HOME_CARDS) {
  return [...rows]
    .sort(
      (a, b) =>
        b.verification_labels.length - a.verification_labels.length ||
        a.display_name.localeCompare(b.display_name, "en-ZA") ||
        a.public_id.localeCompare(b.public_id),
    )
    .slice(0, n);
}

/** Null when the catalogue can't be read right now (the page still renders). */
export async function homeCatalogue(
  config: CatalogueConfig,
  send: typeof fetch = fetch,
): Promise<HomeCatalogue | null> {
  try {
    const [total, perCategory, rows] = await Promise.all([
      count(config, null, send),
      Promise.all(
        CATEGORIES.map((c) =>
          count(config, [c.slug, ...c.children.map((s) => s.slug)], send),
        ),
      ),
      (async () => {
        const response = await send(
          endpoint(
            config,
            new URLSearchParams({
              select: COLUMNS,
              order: "public_id.asc",
              limit: String(POOL),
            }),
          ),
          {
            headers: headers(config),
            redirect: "manual",
            signal: AbortSignal.timeout(3_000),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("listings unavailable");
        }
        return response.json<PublicListing[]>();
      })(),
    ]);
    const counts: Record<string, number> = {};
    CATEGORIES.forEach((c, i) => {
      counts[c.slug] = perCategory[i] ?? 0;
    });
    return { counts, total, listings: pickCards(rows) };
  } catch {
    return null;
  }
}
