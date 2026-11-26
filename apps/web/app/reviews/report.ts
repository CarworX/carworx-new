/**
 * The report reasons a visitor can pick (A8). Shared by the report form and
 * its action; the text that reaches the database is built here.
 */
export const REPORT_REASONS = [
  "Not about a real visit or enquiry",
  "Rude, hateful or threatening",
  "Shares personal details",
  "Spam or advertising",
  "Something else",
] as const;

/**
 * The reason stored with the report, or null if the choice is unknown or
 * "Something else" has no note. The database wants 10 to 500 characters.
 */
export function reportText(choice: string, note: string | null): string | null {
  if (!(REPORT_REASONS as readonly string[]).includes(choice)) return null;
  const extra = (note ?? "").trim();
  if (choice === "Something else") {
    if (extra.length < 3) return null;
    return `${choice}: ${extra}`.slice(0, 500);
  }
  return extra.length > 0 ? `${choice}: ${extra}`.slice(0, 500) : choice;
}
