/**
 * What the site header may show about the signed-in person: a first name for
 * the greeting, and initials for the avatar. Never the full email (C1 rule).
 * Shared by the server reader (viewer.server.ts) and the components.
 */
export interface Viewer {
  /** Null when no name is on file yet; the header then says "Account". */
  firstName: string | null;
  /** One or two capitals for the avatar. */
  initials: string;
}

/** The first word of a display name, trimmed. "" when there is none. */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

/**
 * Avatar initials: the first letters of the first two words of the name; with
 * no name, the first letter of the email's local part (never the whole email).
 */
export function initialsOf(name: string | null, email: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join("");
  }
  const local = (email ?? "").split("@")[0] ?? "";
  const letter = local.charAt(0).toUpperCase();
  return letter === "" ? "?" : letter;
}
