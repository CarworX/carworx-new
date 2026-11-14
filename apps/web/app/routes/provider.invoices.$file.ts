import { requireSignedIn } from "../auth/session.server";
import { rpc } from "../server/bookings/shared";
import { invoiceResponse } from "../server/receipts/invoice-route.server";
import type { Route } from "./+types/provider.invoices.$file";

/** GET /provider/invoices/CXI-000001.pdf: a provider invoice and statement. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  return invoiceResponse(params.file, {
    headers: signedIn.headers,
    invoice: (ref) =>
      rpc(signedIn.supabase, "provider_invoice", { p_ref: ref }),
  });
}
