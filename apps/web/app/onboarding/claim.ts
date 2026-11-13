export const CLAIM_DOCUMENTS = [
  { value: "registration", label: "Business registration" },
  { value: "utility", label: "Utility bill" },
  { value: "lease", label: "Premises lease" },
] as const;

/** Describe a document using picks only; never upload or paste the document itself. */
export function claimDocumentReference(
  form: FormData,
  today = new Date(),
): string | null {
  const document = CLAIM_DOCUMENTS.find(
    (choice) => choice.value === form.get("documentType"),
  );
  const year = form.get("documentYear");
  const month = form.get("documentMonth");
  const day = form.get("documentDay");
  if (
    !document ||
    typeof year !== "string" ||
    typeof month !== "string" ||
    typeof day !== "string" ||
    !/^(?:19|20)\d{2}$/.test(year) ||
    !/^(?:0[1-9]|1[0-2])$/.test(month) ||
    !/^(?:0[1-9]|[12]\d|3[01])$/.test(day)
  )
    return null;
  const date = `${year}-${month}-${day}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date > today.toISOString().slice(0, 10)
  )
    return null;
  return `${document.label} · ${date}`;
}
