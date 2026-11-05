/** Shared pure policy for app actions and the independently deployed Auth hook. */
export const RECIPIENT_SETTING = "STAGING_APPROVED_RECIPIENTS_JSON";
export const RECIPIENT_POLICY_VERSION = "exact-email-v1";

export function canonicalEmail(value: unknown): string | null {
  if (typeof value !== "string" || /[\r\n*]/.test(value)) return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  const at = email.indexOf("@");
  const local = email.slice(0, at);
  if (
    at < 1 ||
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..")
  )
    return null;
  return /^[a-z0-9.!#$%&'+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(
    email,
  )
    ? email
    : null;
}

export function approvedRecipients(value: unknown): ReadonlySet<string> | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const emails = parsed.map((entry: unknown) => canonicalEmail(entry));
    if (emails.some((entry) => entry === null)) return null;
    return new Set(emails as string[]);
  } catch {
    return null;
  }
}

export function loopbackOrigin(value: string): boolean {
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(value).hostname,
    );
  } catch {
    return false;
  }
}
