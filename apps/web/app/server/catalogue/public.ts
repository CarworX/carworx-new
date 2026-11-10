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
  mode: "fixed" | "mobile";
  service_slug: string;
  service_name: string;
  category_slug: string;
  category_name: string;
  public_address: string | null;
  public_latitude: number | null;
  public_longitude: number | null;
  verification_labels: string[];
}

export interface CatalogueConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

const COLUMNS =
  "public_id,display_name,description,metro,mode,service_slug,service_name,category_slug,category_name,public_address,public_latitude,public_longitude,verification_labels";
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
      redirect: "error",
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
