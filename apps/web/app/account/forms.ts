export const ACCOUNT_TABS = [
  "profile",
  "security",
  "notifications",
  "privacy",
  "work",
] as const;

export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** The settings tab bar. "business" is its own route (account.business.tsx). */
export const ACCOUNT_NAV = [
  { id: "profile", label: "Profile", href: "/account/profile" },
  { id: "security", label: "Security", href: "/account/security" },
  {
    id: "notifications",
    label: "Notifications",
    href: "/account/notifications",
  },
  { id: "privacy", label: "Privacy and data", href: "/account/privacy" },
  { id: "work", label: "Your work", href: "/account/work" },
  { id: "business", label: "Business", href: "/account/business" },
] as const;

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

/**
 * An optional South African mobile number (finish-build PR 6): "" means
 * none; "072 000 0000", "0720000000", "+27 72 000 0000" and "27720000000"
 * all become "+27720000000". Anything else is null (invalid). Private: shown
 * only to the person.
 */
export function mobileNumber(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return "";
  if (raw.length > 32 || !/^\+?[\d\s()-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "");
  const national = digits.startsWith("27")
    ? digits.slice(2)
    : digits.startsWith("0")
      ? digits.slice(1)
      : null;
  if (national === null || !/^[1-9]\d{8}$/.test(national)) return null;
  return `+27${national}`;
}

/** "+27720000000" shown as "072 000 0000". */
export function localMobile(stored: string | null | undefined): string {
  if (typeof stored !== "string" || !/^\+27\d{9}$/.test(stored)) return "";
  const n = `0${stored.slice(3)}`;
  return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
}
