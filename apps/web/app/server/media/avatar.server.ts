/**
 * Profile photos (finish-build PR 6, D-098). Same cleaning and limits as the
 * cover photo (./image, ./limits), stored under avatars/ in MEDIA. Unlike
 * covers, avatars are never public: only the person fetches theirs, through
 * /account/photo.
 */
export const AVATAR_KEY = /^avatars\/[0-9a-f]{32}\.(?:jpg|png|webp)$/;

export function newAvatarKey(extension: "jpg" | "png" | "webp") {
  return `avatars/${crypto.randomUUID().replaceAll("-", "")}.${extension}`;
}
