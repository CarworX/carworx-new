/**
 * GET /provider/invoices/:ref.pdf (planning/claude/25 §3a (b)). Signed in,
 * owners and managers of the invoiced business only (D-089). Everyone else,
 * every unknown or malformed reference, and every request while the G-PAY /
 * D-054 gate is off, gets the same plain 404. private, no-store, attachment.
 */
import { PRIVATE_NO_STORE } from "../security/boundary";
import { INVOICE_REF, parseInvoice, renderInvoicePdf } from "./invoice";

export interface InvoiceCaller {
  headers: Headers;
  /** The signed-in user's provider_invoice RPC (RLS as that user). */
  invoice(ref: string): Promise<{ data: unknown; error: unknown }>;
}

const FILE = /^(CXI-[0-9]{6,12})\.pdf$/;

function plain(status: 404 | 503, headers: Headers): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "text/plain; charset=utf-8");
  h.set("Cache-Control", PRIVATE_NO_STORE);
  return new Response(status === 404 ? "Not found" : "Unavailable", {
    status,
    headers: h,
  });
}

export async function invoiceResponse(
  file: string | undefined,
  caller: InvoiceCaller,
): Promise<Response> {
  const ref = FILE.exec(file ?? "")?.[1];
  if (ref === undefined || !INVOICE_REF.test(ref))
    return plain(404, caller.headers);
  let result: { data: unknown; error: unknown };
  try {
    result = await caller.invoice(ref);
  } catch {
    return plain(503, caller.headers);
  }
  if (result.error !== null && result.error !== undefined)
    return plain(503, caller.headers);
  const invoice = parseInvoice(result.data);
  if (invoice?.ref !== ref) return plain(404, caller.headers);
  const pdf = renderInvoicePdf(invoice);
  const h = new Headers(caller.headers);
  h.set("Content-Type", "application/pdf");
  h.set("Content-Length", String(pdf.byteLength));
  h.set("Cache-Control", PRIVATE_NO_STORE);
  h.set(
    "Content-Disposition",
    `attachment; filename="carworx-invoice-${invoice.ref}.pdf"`,
  );
  h.set("X-Robots-Tag", "noindex");
  return new Response(pdf, { status: 200, headers: h });
}
