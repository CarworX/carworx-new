import { data, Form, Link, redirect } from "react-router";
import { throwStatus } from "../auth/http.server";
import { requireSignedIn, type SignedIn } from "../auth/session.server";
import { AuthPage, CsrfField } from "../auth/ui";
import { createIdentitySession } from "../server/identity/didit.server";
import {
  hasApprovedIdentity,
  PAYMENT_ID,
  parseScenario,
  paymentStatus,
  sandboxAdapter,
  sandboxCallbackRequest,
  sandboxEnabled,
} from "../server/fines/sandbox.server";
import { dispatchFinesCallback } from "./api.fines.callback";
import type { Route } from "./+types/fines.mine";

const formatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

type Payment = {
  id: string;
  cents: number;
  status: string;
  receipt_number: string | null;
};

async function readPayment(
  auth: SignedIn,
  id: string | null,
): Promise<Payment | null> {
  if (!id || !PAYMENT_ID.test(id)) return null;
  const result: { data: unknown; error: unknown } = await auth.supabase
    .from("fines_payments")
    .select("id,cents,status,receipt_number")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (result.error) throwStatus(503);
  return result.data as Payment | null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  if (!sandboxEnabled(env)) throwStatus(404);
  const auth = await requireSignedIn(request, context.security);
  const params = new URL(request.url).searchParams;
  const scenario = parseScenario(params.get("scenario"));
  const approved = await hasApprovedIdentity(auth);
  return data(
    {
      csrf: context.security.csrfToken,
      approved,
      scenario,
      result: approved
        ? await sandboxAdapter(env, auth, scenario).lookup(auth.user.id)
        : null,
      payment: approved ? await readPayment(auth, params.get("payment")) : null,
    },
    { headers: auth.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  if (!sandboxEnabled(env)) throwStatus(404);
  const auth = await requireSignedIn(request, context.security);
  const form = await request.formData();
  const intent = form.get("intent");
  if (intent === "verify") {
    try {
      const { url } = await createIdentitySession(
        env,
        auth.user.id,
        "/fines/mine",
      );
      return redirect(url, { headers: auth.headers });
    } catch {
      return data(
        { problem: "Unable to start a new ID check right now." },
        { status: 409, headers: auth.headers },
      );
    }
  }
  if (!(await hasApprovedIdentity(auth))) {
    return data(
      { problem: "Verify your identity before checking fines." },
      { status: 403, headers: auth.headers },
    );
  }
  if (intent === "checkout") {
    const notices = form.getAll("notice");
    if (
      notices.length === 0 ||
      notices.some((notice) => typeof notice !== "string")
    )
      return data(
        { problem: "Select a valid notice." },
        { status: 400, headers: auth.headers },
      );
    try {
      const { url } = await sandboxAdapter(env, auth).startCheckout(
        auth.user.id,
        notices as string[],
      );
      return redirect(url, { headers: auth.headers });
    } catch {
      return data(
        { problem: "Unable to start checkout for that notice." },
        { status: 409, headers: auth.headers },
      );
    }
  }
  if (intent !== "simulate") {
    return data(
      { problem: "Invalid checkout action." },
      { status: 400, headers: auth.headers },
    );
  }
  const paymentId = form.get("payment");
  const status = form.get("status");
  if (typeof paymentId !== "string" || !paymentStatus(status)) {
    return data(
      { problem: "Invalid test outcome." },
      { status: 400, headers: auth.headers },
    );
  }
  const payment = await readPayment(auth, paymentId);
  if (!payment) throwStatus(404);
  if (payment.status === "created" || payment.status === "pending_issuer") {
    const event = await sandboxCallbackRequest(env, auth.config.appOrigin, {
      paymentId,
      status,
    });
    const response = await dispatchFinesCallback(event, env);
    if (!response.ok) throwStatus(503);
  }
  return redirect("/fines/mine?payment=" + paymentId, {
    headers: auth.headers,
  });
}

export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
  const headers = new Headers(loaderHeaders);
  for (const cookie of actionHeaders.getSetCookie())
    headers.append("Set-Cookie", cookie);
  headers.set("Cache-Control", "private, no-store");
  return headers;
}

function PaymentView({ payment, csrf }: { payment: Payment; csrf: string }) {
  return (
    <>
      <p>{formatter.format(payment.cents / 100)}</p>
      {payment.status === "paid" ? (
        <p role="status">
          Issuer confirmed settlement. Receipt {payment.receipt_number}.
        </p>
      ) : payment.status === "failed" || payment.status === "cancelled" ? (
        <p role="status">No payment was confirmed.</p>
      ) : (
        <p role="status">Awaiting issuer confirmation.</p>
      )}
      {(payment.status === "created" ||
        payment.status === "pending_issuer") && (
        <Form method="post">
          <CsrfField token={csrf} />
          <input type="hidden" name="intent" value="simulate" />
          <input type="hidden" name="payment" value={payment.id} />
          <label className="cx-field">
            Test outcome
            <select className="cx-input" name="status">
              <option value="paid">Issuer confirms settlement</option>
              <option value="pending_issuer">Settlement pending</option>
              <option value="cancelled">Checkout cancelled</option>
              <option value="failed">Checkout failed</option>
            </select>
          </label>
          <button className="cx-btn primary wide" type="submit">
            Run simulated checkout
          </button>
        </Form>
      )}
      <Link to="/fines/mine">Back to My Fines</Link>
    </>
  );
}

export default function MyFines({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, approved, payment, scenario, result } = loaderData;
  return (
    <AuthPage title={payment ? "Sample checkout" : "My Fines"}>
      <p>Sample fines and payments are for testing. No money moves.</p>
      {actionData?.problem && <p role="alert">{actionData.problem}</p>}
      {!approved ? (
        <Form method="post" reloadDocument>
          <CsrfField token={csrf} />
          <p>
            Didit checks your ID and selfie before you can view or pay fines.
          </p>
          <button className="cx-btn primary wide" name="intent" value="verify">
            Start identity check
          </button>
        </Form>
      ) : payment ? (
        <PaymentView payment={payment} csrf={csrf} />
      ) : (
        <>
          <Form method="get">
            <label className="cx-field">
              Sample lookup
              <select
                className="cx-input"
                name="scenario"
                defaultValue={scenario}
              >
                <option value="sample">Two sample fines</option>
                <option value="empty">No results</option>
                <option value="unavailable">Service unavailable</option>
              </select>
            </label>
            <button className="cx-btn primary wide" type="submit">
              Check sample fines
            </button>
          </Form>
          {result === null || result === "unavailable" ? (
            <p role="status">Fine lookup is unavailable. Try again.</p>
          ) : (
            <>
              <p>Fines checked across {result.coverage.join(", ")}.</p>
              {result.fines.length === 0 ? (
                <p role="status">
                  No fines found across the authorities checked.
                </p>
              ) : (
                <ul className="grid gap-4">
                  {result.fines.map((fine) => (
                    <li key={fine.id} className="cx-field">
                      <strong>
                        {fine.offence} · {fine.id}
                      </strong>
                      <p>
                        {fine.issuer} · {formatter.format(fine.cents / 100)}
                      </p>
                      {fine.payable ? (
                        <Form method="post">
                          <CsrfField token={csrf} />
                          <input type="hidden" name="notice" value={fine.id} />
                          <button name="intent" value="checkout">
                            Pay sample fine
                          </button>
                        </Form>
                      ) : (
                        <p>{fine.reasonNotPayable}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <Link to="/fines">Official fines guidance</Link>
        </>
      )}
    </AuthPage>
  );
}
