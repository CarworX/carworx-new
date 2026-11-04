/** Server-side form parsing for the auth routes. Plain checks; no echo of input. */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function parseEmail(form: FormData): string | null {
  const email = field(form, "email").trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function parsePassword(
  form: FormData,
  name = "password",
): string | null {
  const password = field(form, name);
  return password.length >= MIN_PASSWORD_LENGTH &&
    password.length <= MAX_PASSWORD_LENGTH
    ? password
    : null;
}

/** A checkbox counts as ticked only when the browser sent it. */
export function isTicked(form: FormData, name: string): boolean {
  return field(form, name) === "on";
}

export function parseTotpCode(form: FormData): string | null {
  const code = field(form, "code").replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}
