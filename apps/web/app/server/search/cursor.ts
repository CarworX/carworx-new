/**
 * Signed, expiring keyset cursors for P2-2 search (Claude 19 §4).
 *
 * A cursor holds only public IDs, a 0.1 km bucket and a hash of the normalised
 * query. It is bound to its group and query, expires after 15 minutes and is
 * verified in constant time (WebCrypto HMAC verify). Anything else is invalid.
 */
export type SearchGroup = "fixed" | "mobile";
export type FixedAfter = { bucket: number; id: string };
export type MobileAfter = { id: string };

export const CURSOR_TTL_MS = 15 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CONTEXT = "carworx-search-cursor-v1.";
const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]{1,2048}$/.test(text)) return null;
  try {
    const raw = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) throw new Error("Search cursor key unavailable");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Hex SHA-256 of the canonical query string. Reveals nothing the client lacks. */
export async function queryHash(canonical: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(canonical),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function signCursor(
  secret: string,
  group: SearchGroup,
  canonicalQuery: string,
  after: FixedAfter | MobileAfter,
  now = Date.now(),
): Promise<string> {
  const payload = {
    v: 1,
    g: group,
    q: await queryHash(canonicalQuery),
    a: after,
    e: now + CURSOR_TTL_MS,
  };
  const body = b64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(CONTEXT + body),
  );
  return `${body}.${b64url(new Uint8Array(signature))}`;
}

/** Returns the keyset position, or null for any tampered/expired/mismatched cursor. */
export async function readCursor(
  secret: string,
  group: SearchGroup,
  canonicalQuery: string,
  token: string,
  now = Date.now(),
): Promise<FixedAfter | MobileAfter | null> {
  if (token.length > 1024) return null;
  const [body, mac, extra] = token.split(".");
  if (body === undefined || mac === undefined || extra !== undefined)
    return null;
  const signature = fromB64url(mac);
  const bytes = fromB64url(body);
  if (signature === null || bytes === null) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signature,
    encoder.encode(CONTEXT + body),
  );
  if (!valid) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    );
  } catch {
    return null;
  }
  const p = payload as {
    v?: unknown;
    g?: unknown;
    q?: unknown;
    a?: { bucket?: unknown; id?: unknown } | null;
    e?: unknown;
  };
  if (
    p.v !== 1 ||
    p.g !== group ||
    p.q !== (await queryHash(canonicalQuery)) ||
    typeof p.e !== "number" ||
    !Number.isFinite(p.e) ||
    now >= p.e ||
    p.e - now > CURSOR_TTL_MS ||
    typeof p.a !== "object" ||
    p.a === null ||
    typeof p.a.id !== "string" ||
    !UUID.test(p.a.id)
  )
    return null;
  if (group === "mobile")
    return p.a.bucket === undefined ? { id: p.a.id } : null;
  return Number.isInteger(p.a.bucket) &&
    (p.a.bucket as number) >= 0 &&
    (p.a.bucket as number) <= 500
    ? { bucket: p.a.bucket as number, id: p.a.id }
    : null;
}
