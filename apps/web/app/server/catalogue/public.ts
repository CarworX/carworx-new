/**
 * Public catalogue reads for category and listing pages (P2-3). These use the
 * publishable key against `listing_public`, the exact public projection that
 * anon may read (P2-1, A10). No location filter happens here: radius search
 * always goes through the scoped P2-2 wrapper.
 */
export interface PublicListing {
  public_id: string;
  display_name: string;
  description: string;
  metro: string;
  mode: "fixed" | "mobile" | "both";
  service_slug: string;
  service_name: string;
  category_slug: string;
  category_name: string;
  public_address: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  verification_labels: string[];
  /** R2 key of the listing's cover photo (D-098), or null. */
  cover_key?: string | null;
  rating_avg?: number | null;
  rating_count?: number;
}

export interface CatalogueConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

const COLUMNS =
  "public_id,display_name,description,metro,mode,service_slug,service_name,category_slug,category_name,public_address,public_latitude,public_longitude,verification_labels,cover_key,rating_avg,rating_count";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SLUG = /^[a-z][a-z0-9-]{0,79}$/;
export const PAGE_SIZE = 20;

export class CatalogueUnavailable extends Error {}

async function read(
  config: CatalogueConfig,
  query: URLSearchParams,
  send: typeof fetch,
): Promise<PublicListing[]> {
  const url = new URL("/rest/v1/listing_public", config.supabaseUrl);
  url.search = query.toString();
  try {
    const response = await send(url, {
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${config.supabasePublishableKey}`,
        Accept: "application/json",
      },
      redirect: "manual", // Workers reject "error"; a 3xx is !ok and fails closed below.
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new CatalogueUnavailable();
    }
    return await response.json<PublicListing[]>();
  } catch {
    throw new CatalogueUnavailable();
  }
}

/** A page of live listings in the given category slugs, by public ID. */
export async function listingsInCategories(
  config: CatalogueConfig,
  slugs: readonly string[],
  after: string | null,
  send: typeof fetch = fetch,
): Promise<{ items: PublicListing[]; next: string | null }> {
  if (slugs.length === 0 || !slugs.every((s) => SLUG.test(s)))
    return { items: [], next: null };
  const query = new URLSearchParams({
    select: COLUMNS,
    category_slug: `in.(${slugs.join(",")})`,
    order: "public_id.asc",
    limit: String(PAGE_SIZE + 1),
  });
  if (after !== null && UUID.test(after)) query.set("public_id", `gt.${after}`);
  const rows = await read(config, query, send);
  const items = rows.slice(0, PAGE_SIZE);
  return {
    items,
    next: rows.length > PAGE_SIZE ? (items.at(-1)?.public_id ?? null) : null,
  };
}

/** One live listing by public ID, or null. */
export async function listingById(
  config: CatalogueConfig,
  id: string,
  send: typeof fetch = fetch,
): Promise<PublicListing | null> {
  if (!UUID.test(id)) return null;
  const rows = await read(
    config,
    new URLSearchParams({ select: COLUMNS, public_id: `eq.${id}`, limit: "1" }),
    send,
  );
  return rows[0] ?? null;
}

const COVER = /^covers\/[0-9a-f]{32}\.(?:jpg|png|webp)$/;

type CardDetails = Pick<
  PublicListing,
  "cover_key" | "rating_avg" | "rating_count"
>;

/** Add photo and review summaries to search cards in one bounded public read. */
export async function listingCardDetails(
  config: CatalogueConfig,
  ids: readonly string[],
  send: typeof fetch = fetch,
): Promise<Map<string, CardDetails>> {
  const wanted = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, 100);
  if (wanted.length === 0) return new Map();
  try {
    const rows = await read(
      config,
      new URLSearchParams({
        select: "public_id,cover_key,rating_avg,rating_count",
        public_id: `in.(${wanted.join(",")})`,
      }),
      send,
    );
    return new Map(
      rows.map((r) => [
        r.public_id,
        {
          cover_key:
            r.cover_key && COVER.test(r.cover_key) ? r.cover_key : null,
          rating_avg: r.rating_avg,
          rating_count: r.rating_count,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

/** True when this key is the current cover of a live listing. */
export async function isPublicCover(
  config: CatalogueConfig,
  key: string,
  send: typeof fetch = fetch,
): Promise<boolean> {
  if (!COVER.test(key)) return false;
  const rows = await read(
    config,
    new URLSearchParams({
      select: "public_id",
      cover_key: `eq.${key}`,
      limit: "1",
    }),
    send,
  );
  return rows.length === 1;
}
