/**
 * /auth/terms: the consent page a signed-in person sees before any other
 * signed-in page or action while their account terms are pending (B-10 part 2b).
 * Accept records the terms (accept_account_terms). Decline closes the account
 * through the existing closure flow (decline_terms_and_close), then signs out.
 */
import { data } from "react-router";

import { ACCOUNT_TERMS_VERSION } from "../account-terms.server";
import { signedInDestination } from "../after-sign-in.server";
import { throwRedirect } from "../http.server";
import { requireSignedIn } from "../session.server";
import { readTermsState } from "../terms-gate.server";
import { AuthPage, CsrfField } from "../ui";
import { safeReturnTo } from "../../server/security/redirect";
import type { Route } from "./+types/terms";

export const meta: Route.MetaFunction = () => [
  { title: "Before you continue · CarworX" },
  { name: "robots", content: "noindex" },
];

/** A returnTo from the query or the form, kept to this site's own paths. */
function nextFrom(value: unknown, appOrigin: string): string | null {
  if (typeof value !== "string" || value === "") return null;
  const safe = safeReturnTo(value, appOrigin, "");
  return safe === "" ? null : safe;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  signedIn.headers.set("Cache-Control", "private, no-store");
  const returnTo = nextFrom(
    new URL(request.url).searchParams.get("returnTo"),
    signedIn.config.appOrigin,
  );
  // Nothing to accept (accepted, or unreadable and so let through): move on.
  if ((await readTermsState(signedIn.supabase)) !== "pending") {
    throwRedirect(
      returnTo ?? (await signedInDestination(signedIn.supabase)),
      signedIn.headers,
    );
  }
  return data(
    { csrf: context.security.csrfToken, returnTo: returnTo ?? "" },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  signedIn.headers.set("Cache-Control", "private, no-store");
  const form = await request.formData();
  const returnTo = nextFrom(form.get("returnTo"), signedIn.config.appOrigin);

  if (form.get("intent") === "accept") {
    const result = await signedIn.supabase.rpc("accept_account_terms", {
      p_version: ACCOUNT_TERMS_VERSION,
    });
    if (result.error !== null)
      return data(
        { problem: "accept" },
        { status: 409, headers: signedIn.headers },
      );
    throwRedirect(
      returnTo ?? (await signedInDestination(signedIn.supabase)),
      signedIn.headers,
    );
  }

  if (form.get("intent") === "decline") {
    const result = await signedIn.supabase.rpc("decline_terms_and_close");
    // An older account is refused by the RPC: the person is told to contact
    // support rather than closed here.
    if (result.error !== null)
      return data(
        { problem: "decline" },
        { status: 409, headers: signedIn.headers },
      );
    await signedIn.supabase.auth.signOut({ scope: "local" });
    throwRedirect("/", signedIn.headers);
  }

  return data(
    { problem: "intent" },
    { status: 400, headers: signedIn.headers },
  );
}

export default function Terms({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const problem = actionData?.problem;
  return (
    <AuthPage title="Before you continue">
      <div className="cx-auth-terms">
        <p>
          Please read our terms of use and privacy notice, then accept them to
          keep using your CarworX account.
        </p>
        <p className="type-caption">
          I agree to the <a href="/terms">Terms of use</a> and have read the{" "}
          <a href="/privacy">Privacy notice</a>.
        </p>
        {problem === "accept" ? (
          <p role="alert">We couldn&apos;t record that. Try again.</p>
        ) : null}
        <form method="post">
          <CsrfField token={loaderData.csrf} />
          <input type="hidden" name="returnTo" value={loaderData.returnTo} />
          <button type="submit" name="intent" value="accept">
            Accept and continue
          </button>
        </form>
        {problem === "decline" ? (
          <p role="alert">Contact support to close your account.</p>
        ) : null}
        <form method="post">
          <CsrfField token={loaderData.csrf} />
          <input type="hidden" name="returnTo" value={loaderData.returnTo} />
          <p className="type-caption">
            If you decline, your account is closed. You can still reinstate it
            within 14 days by signing in.
          </p>
          <button type="submit" name="intent" value="decline">
            Decline and close my account
          </button>
        </form>
      </div>
    </AuthPage>
  );
}
