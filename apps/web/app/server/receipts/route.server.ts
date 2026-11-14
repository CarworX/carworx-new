/**
 * GET /receipts/:ref.pdf (planning/claude/25 §3a). Signed in, the paying
 * customer only. Everyone else, and every unknown, unpaid or malformed
 * reference, gets the same plain 404: never a 403 that would confirm the
 * receipt exists. A signed-out visitor is sent to sign in first (the same
 * for any reference, so that reveals nothing either).
 *
 * The document is personal: Cache-Control private, no-store, and it is
 * downloaded, not shown inline. Nothing about the customer is logged.
 */
import { PRIVATE_NO_STORE } from "../security/boundary";
import { parseReceipt, RECEIPT_REF, renderReceiptPdf } from "./receipt";

export interface ReceiptCaller {
  /** Set-Cookie headers from the session refresh, passed back unchanged. */
  headers: Headers;
  /** The signed-in user's customer_receipt RPC (RLS as that user). */
  receipt(ref: string): Promise<{ data: unknown; error: unknown }>;
}

const FILE = /^(CX-[0-9A-F]{12})\.pdf$/;

function plain(status: 404 | 503, headers: Headers): Response {
  const h = new Headers(headers);
  h.set("Content-Type", "text/plain; charset=utf-8");
  h.set("Cache-Control", PRIVATE_NO_STORE);
  return new Response(status === 404 ? "Not found" : "Unavailable", {
    status,
    headers: h,
  });
}

export async function receiptResponse(
  file: string | undefined,
  caller: ReceiptCaller,
): Promise<Response> {
  const ref = FILE.exec(file ?? "")?.[1];
  if (ref === undefined || !RECEIPT_REF.test(ref))
    return plain(404, caller.headers);
  let result: { data: unknown; error: unknown };
  try {
    result = await caller.receipt(ref);
  } catch {
    return plain(503, caller.headers);
  }
  if (result.error !== null && result.error !== undefined)
    return plain(503, caller.headers);
  const receipt = parseReceipt(result.data);
  if (receipt?.ref !== ref) return plain(404, caller.headers);
  const pdf = renderReceiptPdf(receipt);
  const h = new Headers(caller.headers);
  h.set("Content-Type", "application/pdf");
  h.set("Content-Length", String(pdf.byteLength));
  h.set("Cache-Control", PRIVATE_NO_STORE);
  h.set(
    "Content-Disposition",
    `attachment; filename="carworx-receipt-${receipt.ref}.pdf"`,
  );
  h.set("X-Robots-Tag", "noindex");
  return new Response(pdf, { status: 200, headers: h });
}
