/**
 * Cover photo storage (finish-build PR 3, D-098). Files live in the R2
 * bucket bound as MEDIA under a random key; public.listing_covers points at
 * them. The bucket is created at deploy (staging: carworx-media-staging,
 * production: carworx-media-production); this code never creates resources.
 */
import type { ImageType } from "./image";

/** covers/<32 hex>.<ext>: the only keys this app writes or serves. */
export const COVER_KEY = /^covers\/[0-9a-f]{32}\.(?:jpg|png|webp)$/;
export const COVER_FILE = /^[0-9a-f]{32}\.(?:jpg|png|webp)$/;

export const TYPE_BY_EXTENSION: Record<string, ImageType> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** The subset of R2Bucket this app uses (an in-memory one in tests). */
export interface MediaBucket {
  put(
    key: string,
    value: Uint8Array,
    options: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream } | null>;
  delete(keys: string | string[]): Promise<void>;
}

export function mediaBucket(env: unknown): MediaBucket | null {
  const media = (env as { MEDIA?: unknown } | null)?.MEDIA;
  return typeof media === "object" &&
    media !== null &&
    "put" in media &&
    "get" in media &&
    "delete" in media
    ? (media as MediaBucket)
    : null;
}

/** A fresh random key; never derived from the file name or the user. */
export function newCoverKey(extension: "jpg" | "png" | "webp") {
  return `covers/${crypto.randomUUID().replaceAll("-", "")}.${extension}`;
}

/** The URL a page uses for a cover key (served by routes/media.covers.$file). */
export function coverUrl(key: string | null | undefined): string | null {
  return typeof key === "string" && COVER_KEY.test(key)
    ? `/media/${key}`
    : null;
}
