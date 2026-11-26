/**
 * /fines/mine: your traffic fines (A6). Shown only after the ID check is
 * approved (otherwise the verify page). The list comes from the fines adapter
 * (K3); a payment is "paid" only once the issuer has confirmed it, with its
 * receipt. Outside staging this page does not exist: no fines provider is live.
 */
import { data, Form, Link, redirect } from "react-router";

import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn, type SignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { dispatchFinesCallback } from "./api.fines.callback";
import { FINES_HOME, VERIFY, fineHref } from "../fines/fine-links";
import {
  finesView,
  paymentView,
  rand,
  shortDate,
  sastTime,
  type FinesView,
  type PaymentView,
} from "../fines/fine-view";
import {
  hasApprovedIdentity,
  PAYMENT_ID,
  parseScenario,
  paymentStatus,
  sandboxAdapter,
  sandboxCallbackRequest,
  sandboxEnabled,
} from "../server/fines/sandbox.server";
import { PublicShell } from "../ui/public/PublicShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/fines.mine";

export const meta: Route.MetaFunction = () => [
  { title: "Your fines · CarworX" },
  { name: "robots", content: "noindex" },
];

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
  auth.headers.set("Cache-Control", "private, no-store");
  if (!(await hasApprovedIdentity(auth))) throwRedirect(VERIFY, auth.headers);
  const params = new URL(request.url).searchParams;
  const scenario = parseScenario(params.get("scenario"));
  const result = await sandboxAdapter(env, auth, scenario).lookup(auth.user.id);
  const payment = await readPayment(auth, params.get("payment"));
  return data(
    {
      csrf: context.security.csrfToken,
      view: finesView(result),
      checkedAt: result === "unavailable" ? null : result.checkedAt,
      payment: payment
        ? {
            id: payment.id,
            amount: rand(payment.cents),
            view: paymentView(payment.status, payment.receipt_number),
          }
        : null,
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
  if (!(await hasApprovedIdentity(auth)))
    return data(
      { problem: "Confirm your ID before paying a fine." },
      { status: 403, headers: auth.headers },
    );
  if (intent === "checkout") {
    const notices = form.getAll("notice");
    if (
      notices.length === 0 ||
      notices.some((notice) => typeof notice !== "string")
    )
      return data(
        { problem: "Choose at least one fine to pay." },
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
        { problem: "We couldn't start the payment. Nothing was charged." },
        { status: 409, headers: auth.headers },
      );
    }
  }
  if (intent !== "simulate")
    return data(
      { problem: "That action isn't available." },
      { status: 400, headers: auth.headers },
    );
  // Staging only: drive the signed callback the way the payment partner would.
  const paymentId = form.get("payment");
  const status = form.get("status");
  if (typeof paymentId !== "string" || !paymentStatus(status))
    return data(
      { problem: "Choose a valid outcome." },
      { status: 400, headers: auth.headers },
    );
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
  return redirect(`${FINES_HOME}?payment=${paymentId}`, {
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

/** A payment's state, in plain words. Only a confirmed payment says "Paid". */
function PaymentBlock({
  payment,
  csrf,
}: {
  payment: NonNullable<Route.ComponentProps["loaderData"]["payment"]>;
  csrf: string;
}) {
  const view: PaymentView = payment.view;
  return (
    <section aria-labelledby="payment-h" className="cx-payment">
      <h2 id="payment-h">{view.kind === "paid" ? "Paid" : "Your payment"}</h2>
      <p>{payment.amount}</p>
      {view.kind === "paid" ? (
        <StatusNote tone="ok" title="Payment confirmed by the issuer.">
          Receipt {view.receipt}. Keep it for your records.
        </StatusNote>
      ) : view.kind === "checkout" ? (
        <StatusNote
          tone="info"
          title="Checkout started. Waiting for the payment outcome."
        >
          Nothing has been paid yet. Finish on the payment partner&apos;s page;
          this page updates once the outcome is in.
        </StatusNote>
      ) : view.kind === "awaiting" ? (
        <StatusNote
          tone="info"
          title="Payment received. Waiting for the issuer."
        >
          The issuer usually confirms within 1 to 3 business days. We mark the
          fine &quot;Paid&quot; only once it does.
        </StatusNote>
      ) : (
        <StatusNote tone="err" title="The payment didn't go through.">
          {view.text}
        </StatusNote>
      )}
      {view.kind === "awaiting" || view.kind === "checkout" ? (
        // Staging only: this form exists where the sandbox provider is on.
        <Form method="post">
          <CsrfField token={csrf} />
          <input type="hidden" name="intent" value="simulate" />
          <input type="hidden" name="payment" value={payment.id} />
          <label>
            Outcome (staging only)
            <select name="status">
              <option value="paid">Issuer confirms settlement</option>
              <option value="pending_issuer">
                Still waiting for the issuer
              </option>
              <option value="cancelled">Checkout cancelled</option>
              <option value="failed">Checkout failed</option>
            </select>
          </label>
          <button type="submit">Apply outcome</button>
        </Form>
      ) : null}
      <Link to={FINES_HOME}>Back to my fines</Link>
    </section>
  );
}

export default function MyFines({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, view, checkedAt, payment } = loaderData;
  return (
    <PublicShell signedIn>
      <section className="cx-fines-page" aria-labelledby="fines-h">
        <h1 id="fines-h">Your fines</h1>
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {actionData.problem}
          </StatusNote>
        ) : null}
        {payment !== null ? (
          <PaymentBlock payment={payment} csrf={csrf} />
        ) : null}
        {payment === null ? (
          <FinesBody view={view} checkedAt={checkedAt} csrf={csrf} />
        ) : null}
        <p className="type-caption">
          Fines come from the issuers&apos; records through our payment partner.
          If something looks wrong, tell us.
        </p>
      </section>
    </PublicShell>
  );
}

function FinesBody({
  view,
  checkedAt,
  csrf,
}: {
  view: FinesView;
  checkedAt: string | null;
  csrf: string;
}) {
  if (view.kind === "unavailable")
    return (
      <StatusNote
        tone="warn"
        title="We can't reach the fines records right now."
      >
        Try again in a moment.
      </StatusNote>
    );
  if (view.kind === "none")
    return (
      <section>
        <h2>No fines on your ID.</h2>
        <p>
          Nothing to pay right now. We check again each time you open this page.
        </p>
        <Link to="/">Back to home</Link>
      </section>
    );
  return (
    <>
      <p className="type-caption">
        {checkedAt !== null
          ? `Last checked today, ${sastTime(checkedAt)} SAST.`
          : null}
      </p>
      <dl className="cx-fines-stats">
        <div>
          <dt>To settle</dt>
          <dd>{rand(view.totalCents)}</dd>
        </div>
        <div>
          <dt>Open fines</dt>
          <dd>{view.payable.length + view.notPayable.length}</dd>
        </div>
      </dl>
      {view.onlyNotPayable ? (
        <StatusNote
          tone="warn"
          title={`${String(view.notPayable.length)} fine${view.notPayable.length === 1 ? "" : "s"}, but ${view.notPayable.length === 1 ? "it" : "they"} can't be paid online.`}
        >
          Contact the issuer to settle{" "}
          {view.notPayable.length === 1 ? "it" : "them"}.
        </StatusNote>
      ) : null}
      {view.payable.length > 0 ? (
        <Form method="post" aria-label="Fines to pay">
          <CsrfField token={csrf} />
          <input type="hidden" name="intent" value="checkout" />
          <ul className="cx-fine-list">
            {view.payable.map((fine) => (
              <li key={fine.id} className="cx-fine">
                <label>
                  <input type="checkbox" name="notice" value={fine.id} />
                  <span>
                    <strong>{fine.offence}</strong>
                    <span>
                      {fine.issuer} · {shortDate(fine.issued)}
                    </span>
                  </span>
                </label>
                <span>{rand(fine.payCents)}</span>
                <Link to={fineHref(fine.id)}>Details</Link>
              </li>
            ))}
          </ul>
          <button type="submit">
            Pay {rand(view.totalCents)} on a secure checkout
          </button>
          <p className="type-caption">
            On our payment partner&apos;s secure checkout. CarworX never sees
            your card.
          </p>
        </Form>
      ) : null}
      {view.notPayable.length > 0 ? (
        <section aria-labelledby="np-h">
          <h2 id="np-h">Not payable here</h2>
          <p className="type-caption">These need you to contact the issuer.</p>
          <ul className="cx-fine-list muted">
            {view.notPayable.map((fine) => (
              <li key={fine.id} className="cx-fine">
                <span>
                  <strong>{fine.offence}</strong>
                  <span>
                    {fine.issuer} · {shortDate(fine.issued)}
                  </span>
                  {fine.reasonNotPayable ? (
                    <span>{fine.reasonNotPayable}</span>
                  ) : null}
                </span>
                <Link to={fineHref(fine.id)}>Details</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
