/**
 * Image upload limits, in one place (owner, 2026-11-25: "each user's image
 * cannot go above a certain size"). Every photo upload uses these: the
 * listing cover (PR 3) now, the profile photo (PR 6) next. The database
 * CHECKs in 20261124180000_listing_media.sql hold the same numbers.
 */

/** The largest photo file we accept: 5 MB. */
export const MAX_BYTES = 5 * 1024 * 1024;
/** Decompression-bomb guard: no side over 6000 px, at most 40 megapixels. */
export const MAX_SIDE = 6_000;
export const MAX_PIXELS = 40_000_000;
/** Room for the other form fields and multipart framing around the file. */
export const UPLOAD_OVERHEAD = 64 * 1024;
/** The largest upload request body: the file plus the form around it. */
export const MAX_UPLOAD_REQUEST = MAX_BYTES + UPLOAD_OVERHEAD;

/** Shown next to every photo field. */
export const PHOTO_LIMIT_TEXT = "JPEG, PNG or WebP, up to 5 MB";
/** Shown when a photo, or its request, is over the limit. */
export const PHOTO_TOO_LARGE =
  "That photo is too large. Use a JPEG, PNG or WebP photo of up to 5 MB.";

/**
 * True when an upload request must be refused before its body is read:
 * no Content-Length (browsers always send one for a form post), a value that
 * isn't a plain whole number, or one over MAX_UPLOAD_REQUEST. The security
 * boundary also stops reading a body at the limit, so a body longer than its
 * stated length is refused too.
 */
export function uploadTooLarge(request: Request): boolean {
  const header = request.headers.get("Content-Length");
  if (header === null || !/^\d{1,12}$/.test(header.trim())) return true;
  return Number(header.trim()) > MAX_UPLOAD_REQUEST;
}
