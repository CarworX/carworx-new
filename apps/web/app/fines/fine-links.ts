/** The fines pages' own addresses, in one place (A6). */
export const FINES_HOME = "/fines/mine";
export const VERIFY = "/fines/verify";
export const landingFines = "/#fines";

/** The detail page for one notice on this person's ID. */
export function fineHref(id: string): string {
  return `/fines/${encodeURIComponent(id)}`;
}
