import { money } from "../server/mail-templates/format";
import { monthName } from "../server/receipts/invoice";
import type { InvoiceRow } from "../server/receipts/invoice-list";
import { EmptyState } from "./Note";

/** Invoices and statements, newest first, each with a PDF download link. */
export function InvoiceList({ invoices }: { invoices: InvoiceRow[] }) {
  const several = new Set(invoices.map((i) => i.business)).size > 1;
  return invoices.length === 0 ? (
    <EmptyState title="No invoices yet">
      Your first invoice and statement arrives after the end of a month with
      bookings paid in the app.
    </EmptyState>
  ) : (
    <ul className="grid gap-3">
      {invoices.map((i) => (
        <li
          key={i.ref}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] p-4"
          data-invoice={i.ref}
        >
          <p className="type-body">
            <b>{monthName(i.period_start)}</b>
            {several ? ` · ${i.business}` : ""} · {i.jobs} job
            {i.jobs === 1 ? "" : "s"} · CarworX fee {money(i.total_minor)}{" "}
            <span className="font-mono">{i.ref}</span>
          </p>
          <a
            className="cx-tlink"
            href={`/provider/invoices/${i.ref}.pdf`}
            download
            aria-label={`Download ${i.ref} (PDF)`}
          >
            Download PDF
          </a>
        </li>
      ))}
    </ul>
  );
}
