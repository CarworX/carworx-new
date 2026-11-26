/**
 * /fines/:id: one notice on this ID (A6). Its details, and a single payment
 * when the issuer takes payment here. Staging only, like the list it comes from.
 */
import { data, Form, Link, redirect } from "react-router";

import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { FINES_HOME, VERIFY } from "../fines/fine-links";
import { fineById, rand, shortDate } from "../fines/fine-view";
import {
  hasApprovedIdentity,
  parseScenario,
  sandboxAdapter,
  sandboxEnabled,
} from "../server/fines/sandbox.server";
import { PublicShell } from "../ui/public/PublicShell";
import { StatusNote } from "../ui/Note";
import type { Route } from "./+types/fines.$id";

export const meta: Route.MetaFunction = () => [
  { title: "Fine details · CarworX" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const env = context.cloudflare.env;
  if (!sandboxEnabled(env)) throwStatus(404);
  const auth = await requireSignedIn(request, context.security);
  auth.headers.set("Cache-Control", "private, no-store");
  if (!(await hasApprovedIdentity(auth))) throwRedirect(VERIFY, auth.headers);
  const scenario = parseScenario(
    new URL(request.url).searchParams.get("scenario"),
  );
  const result = await sandboxAdapter(env, auth, scenario).lookup(auth.user.id);
  const fine = fineById(result, params.id);
  if (fine === null) throwStatus(404, auth.headers);
  return data(
    { csrf: context.security.csrfToken, fine },
    { headers: auth.headers },
  );
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  if (!sandboxEnabled(env)) throwStatus(404);
  const auth = await requireSignedIn(request, context.security);
  if (!(await hasApprovedIdentity(auth))) throwRedirect(VERIFY, auth.headers);
  const result = await sandboxAdapter(env, auth).lookup(auth.user.id);
  const fine = fineById(result, params.id);
  if (fine === null) throwStatus(404, auth.headers);
  if (!fine.payable)
    return data(
      { problem: "This notice can't be paid online. Contact the issuer." },
      { status: 400, headers: auth.headers },
    );
  try {
    const { url } = await sandboxAdapter(env, auth).startCheckout(
      auth.user.id,
      [fine.id],
    );
    return redirect(url, { headers: auth.headers });
  } catch {
    return data(
      { problem: "We couldn't start the payment. Nothing was charged." },
      { status: 409, headers: auth.headers },
    );
  }
}

export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
  const headers = new Headers(loaderHeaders);
  for (const cookie of actionHeaders.getSetCookie())
    headers.append("Set-Cookie", cookie);
  headers.set("Cache-Control", "private, no-store");
  return headers;
}

export default function FineDetail({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, fine } = loaderData;
  return (
    <PublicShell signedIn>
      <section className="cx-fine-detail" aria-labelledby="fine-h">
        <p>
          <Link to={FINES_HOME}>← My fines</Link>
        </p>
        <h1 id="fine-h">{fine.offence}</h1>
        <dl>
          <dt>Issuer</dt>
          <dd>{fine.issuer}</dd>
          <dt>Notice number</dt>
          <dd>{fine.id}</dd>
          <dt>Type</dt>
          <dd>{fine.offence}</dd>
          <dt>When</dt>
          <dd>{shortDate(fine.issued)}</dd>
        </dl>
        {actionData?.problem ? (
          <StatusNote tone="err" title="That didn't work.">
            {actionData.problem}
          </StatusNote>
        ) : null}
        {fine.payable ? (
          <Form method="post" className="cx-pay-box">
            <CsrfField token={csrf} />
            <p>To pay</p>
            <p>{rand(fine.amountCents)}</p>
            {fine.discounted ? (
              <p>{rand(fine.payCents)} with the discount</p>
            ) : null}
            <button type="submit">Pay {rand(fine.payCents)}</button>
            <p className="type-caption">
              On our payment partner&apos;s secure checkout.
            </p>
          </Form>
        ) : (
          <StatusNote tone="warn" title="Not payable here.">
            {fine.reasonNotPayable ??
              "Contact the issuer to settle this notice."}
          </StatusNote>
        )}
      </section>
    </PublicShell>
  );
}
