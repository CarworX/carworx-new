/** Public, owner-verified support channel; never infer or invent an inbox. */
export function supportContactEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254) return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const [local, domain] = parts;
  if (!local || !domain || !/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(local))
    return null;
  if (local.includes("..") || local.endsWith(".")) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || !/^[a-z]{2,24}$/.test(labels.at(-1) ?? ""))
    return null;
  if (
    labels.some(
      (label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    )
  )
    return null;
  return email;
}
