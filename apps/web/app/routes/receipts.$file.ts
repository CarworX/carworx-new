import { requireSignedIn } from "../auth/session.server";
import { rpc } from "../server/bookings/shared";
import { receiptResponse } from "../server/receipts/route.server";
import type { Route } from "./+types/receipts.$file";

/** GET /receipts/CX-XXXXXXXXXXXX.pdf: the customer's payment receipt. */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  return receiptResponse(params.file, {
    headers: signedIn.headers,
    receipt: (ref) =>
      rpc(signedIn.supabase, "customer_receipt", { p_ref: ref }),
  });
}
