/** provider_invoices() JSON for the /provider/invoices page (D-096). */
export interface InvoiceRow {
  ref: string;
  business: string;
  period_start: string;
  jobs: number;
  total_minor: number;
}

/** Validate provider_invoices' JSON. null = the gate is off (or bad data). */
export function parseInvoiceList(raw: unknown): InvoiceRow[] | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as { enabled?: unknown; invoices?: unknown };
  if (r.enabled !== true || !Array.isArray(r.invoices)) return null;
  const rows: InvoiceRow[] = [];
  for (const item of r.invoices as unknown[]) {
    const i = (item ?? {}) as Partial<Record<keyof InvoiceRow, unknown>>;
    if (
      typeof i.ref !== "string" ||
      !/^CXI-[0-9]{6,12}$/.test(i.ref) ||
      typeof i.business !== "string" ||
      typeof i.period_start !== "string" ||
      !/^\d{4}-\d{2}-01$/.test(i.period_start) ||
      typeof i.jobs !== "number" ||
      typeof i.total_minor !== "number" ||
      !Number.isSafeInteger(i.total_minor)
    )
      return null;
    rows.push({
      ref: i.ref,
      business: i.business,
      period_start: i.period_start,
      jobs: i.jobs,
      total_minor: i.total_minor,
    });
  }
  return rows;
}
