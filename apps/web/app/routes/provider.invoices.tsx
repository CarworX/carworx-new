import { data, Link } from "react-router";

import { throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { rpc } from "../server/bookings/shared";
import { parseInvoiceList } from "../server/receipts/invoice-list";
import { InvoiceList } from "../ui/InvoiceList";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.invoices";

export const meta: Route.MetaFunction = () => [{ title: "Invoices · CarworX" }];

/**
 * /provider/invoices: every CarworX invoice and monthly statement for the
 * businesses the user owns or manages, each with a Download link (D-096,
 * OQ-E3). Behind the G-PAY / D-054 gate: a 404 until commission starts.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const res = await rpc(signedIn.supabase, "provider_invoices");
  if (res.error !== null) throwStatus(503, signedIn.headers);
  const invoices = parseInvoiceList(res.data);
  if (invoices === null) throwStatus(404, signedIn.headers);
  return data({ invoices }, { headers: signedIn.headers });
}

export default function Invoices({ loaderData }: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <div className="grid max-w-[70ch] gap-5">
        <h1 className="type-title">Invoices and statements</h1>
        <p className="type-body">
          One per month: CarworX&apos;s fee on bookings paid in the app. It is
          taken when the customer pays, so there is nothing to pay here. Kept
          for 5 years.
        </p>
        <InvoiceList invoices={loaderData.invoices} />
        <p>
          <Link to="/provider/bookings" className="cx-tlink">
            Bookings
          </Link>
        </p>
      </div>
    </PublicShell>
  );
}
