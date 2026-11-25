import { data, Form, Link } from "react-router";
import { throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { AuthPage, CsrfField } from "../auth/ui";
import {
  parseOutcome,
  parseScenario,
  sandbox,
  settleSandbox,
  type Outcome,
} from "../server/fines/sandbox.server";
import { readCookie, serializeAppCookie } from "../server/security/cookies";
import type { Route } from "./+types/fines.mine";

const RECEIPT_COOKIE = "__Host-cx-fines-sandbox";
const MAX_AGE = 3600;
const formatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
});

const messages: Record<Outcome, string> = {
  confirmed: "Issuer confirmed settlement in the sandbox.",
  pending: "Payment received in the sandbox. Issuer confirmation is pending.",
  cancelled: "Checkout cancelled. No payment was made.",
  timeout: "The sandbox timed out. No payment has been confirmed.",
};

function checkEnvironment(context: Route.LoaderArgs["context"]) {
  if (context.security.config?.environment !== "staging") throwStatus(404);
}

async function receiptKey(env: unknown) {
  const secret = (env as { SEARCH_CURSOR_KEY?: unknown }).SEARCH_CURSOR_KEY;
  if (typeof secret !== "string" || secret.length < 32) throwStatus(503);
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function receiptInput(owner: string, payload: string) {
  return new TextEncoder().encode(
    `carworx-fines-sandbox-v1\n${owner}\n${payload}`,
  );
}

async function readReceipt(request: Request, owner: string, env: unknown) {
  const cookie = readCookie(request, RECEIPT_COOKIE);
  if (!cookie) return null;
  const [outcome, expires, signature, extra] = cookie.split(".");
  const state = parseOutcome(outcome ?? null);
  if (
    extra !== undefined ||
    state === null ||
    !expires ||
    !/^\d{10}$/.test(expires) ||
    Number(expires) <= Math.floor(Date.now() / 1000) ||
    !signature ||
    !/^[A-Za-z0-9+/]{43}=$/.test(signature)
  )
    return null;
  const input = receiptInput(owner, `${state}.${expires}`);
  const bytes = Uint8Array.from(atob(signature), (c) => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(
    "HMAC",
    await receiptKey(env),
    bytes,
    input,
  );
  return valid ? state : null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  checkEnvironment(context);
  const auth = await requireSignedIn(request, context.security);
  const params = new URL(request.url).searchParams;
  const scenario = parseScenario(params.get("scenario"));
  const notice = params.get("checkout");
  return data(
    {
      csrf: context.security.csrfToken,
      scenario,
      result: sandbox.lookup(scenario),
      checkout:
        scenario === "sample" && notice
          ? (sandbox.checkout(notice) ?? null)
          : null,
      outcome: await readReceipt(request, auth.user.id, context.cloudflare.env),
    },
    { headers: auth.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  checkEnvironment(context);
  const auth = await requireSignedIn(request, context.security);
  const form = await request.formData();
  const notice = form.get("notice");
  const outcome = parseOutcome(form.get("outcome"));
  if (
    typeof notice !== "string" ||
    !sandbox.checkout(notice) ||
    outcome === null
  )
    return data(
      { problem: "Choose a payable synthetic fine and checkout outcome." },
      { status: 400, headers: auth.headers },
    );
  const old = await readReceipt(request, auth.user.id, context.cloudflare.env);
  const state = settleSandbox(old, outcome);
  const payload = `${state}.${String(Math.floor(Date.now() / 1000) + MAX_AGE)}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    await receiptKey(context.cloudflare.env),
    receiptInput(auth.user.id, payload),
  );
  const encoded = btoa(String.fromCharCode(...new Uint8Array(signature)));
  auth.headers.append(
    "Set-Cookie",
    serializeAppCookie(RECEIPT_COOKIE, `${payload}.${encoded}`, {
      maxAge: MAX_AGE,
    }),
  );
  return data({ problem: null }, { headers: auth.headers });
}

export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
  const headers = new Headers(loaderHeaders);
  for (const cookie of actionHeaders.getSetCookie())
    headers.append("Set-Cookie", cookie);
  headers.set("Cache-Control", "private, no-store");
  return headers;
}

export default function MyFines({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { csrf, scenario, result, checkout, outcome } = loaderData;
  return (
    <AuthPage title={checkout ? "Simulated checkout" : "My Fines"}>
      <p>
        <strong>Staging sandbox.</strong> Fines, payment and receipts are
        fictional. No money moves.
      </p>
      {actionData?.problem && <p role="alert">{actionData.problem}</p>}
      {outcome && (
        <p role="status">
          {messages[outcome]}{" "}
          {(outcome === "confirmed" || outcome === "pending") &&
            "Demo receipt DEMO-101."}
        </p>
      )}
      {checkout ? (
        <Form method="post">
          <CsrfField token={csrf} />
          <input type="hidden" name="notice" value={checkout.id} />
          <p>
            {checkout.id} · {formatter.format(checkout.cents / 100)}
          </p>
          <label className="cx-field">
            Test outcome
            <select className="cx-input" name="outcome">
              <option value="confirmed">Issuer confirms settlement</option>
              <option value="pending">
                Payment received, settlement pending
              </option>
              <option value="cancelled">Checkout cancelled</option>
              <option value="timeout">Checkout timed out</option>
            </select>
          </label>
          <button className="cx-btn primary wide" type="submit">
            Run simulated checkout
          </button>
          <Link to="/fines/mine">Back to My Fines</Link>
        </Form>
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
          {result === null ? (
            <p role="status">The sandbox lookup is unavailable. Try again.</p>
          ) : (
            <>
              <p>
                Coverage: example municipal authority. Checked{" "}
                <time dateTime={result.checkedAt}>
                  {new Date(result.checkedAt).toLocaleString("en-ZA", {
                    timeZone: "Africa/Johannesburg",
                  })}{" "}
                  SAST
                </time>
                .
              </p>
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
                      {fine.payable &&
                      outcome !== "confirmed" &&
                      outcome !== "pending" ? (
                        <Link to={`?checkout=${fine.id}`}>Pay sample fine</Link>
                      ) : (
                        <p>
                          {fine.payable
                            ? "Checkout already recorded."
                            : "Not payable in this channel."}
                        </p>
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
