export const ACCOUNT_TABS = [
  "profile",
  "security",
  "notifications",
  "privacy",
  "work",
] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

export function accountTab(value: string | undefined): AccountTab | null {
  return ACCOUNT_TABS.find((tab) => tab === value) ?? null;
}

/** A display label only. It must never be used for permissions or identity checks. */
export function displayName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  // eslint-disable-next-line no-control-regex -- controls are invalid in a display label
  if (name.length < 1 || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name))
    return null;
  return name;
}
