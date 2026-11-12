import { describe, expect, it } from "vitest";
import { claimDocumentReference } from "./claim";

function document(values: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return claimDocumentReference(form, new Date("2026-11-12T12:00:00Z"));
}
const valid = {
  documentType: "utility",
  documentYear: "2026",
  documentMonth: "10",
  documentDay: "31",
};
describe("claim document picks", () => {
  it("makes a bounded reference from document type and date only", () => {
    expect(
      document({
        ...valid,
        documentReference: "never copy arbitrary pasted material",
      }),
    ).toBe("Utility bill · 2026-10-31");
  });
  it.each([
    { ...valid, documentType: "unknown" },
    { ...valid, documentMonth: "02", documentDay: "30" },
    { ...valid, documentYear: "2027" },
    { ...valid, documentDay: "" },
  ])("refuses unknown, impossible, future and missing choices", (input) => {
    expect(document(input)).toBeNull();
  });
});
