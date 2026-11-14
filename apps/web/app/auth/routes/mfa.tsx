import { data, Form, redirect } from "react-router";

import { field, parseTotpCode } from "../forms";
import { throwRedirect, throwStatus } from "../http.server";
import { requireSignedIn } from "../session.server";
import { safeReturnTo } from "../../server/security/redirect";
import { AuthPage, CsrfField, Notice } from "../ui";
import type { Route } from "./+types/mfa";

export const meta: Route.MetaFunction = () => [
  { title: "Two-step sign-in · CarworX" },
];

/**
 * /auth/mfa: TOTP enrolment and challenge (D-042). Verifying a code raises
 * the session to aal2, which admin pages and admin RLS policies require.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function returnPath(value: string | null, appOrigin: string): string {
  return safeReturnTo(value, appOrigin, "/admin");
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const url = new URL(request.url);
  const returnTo = returnPath(
    url.searchParams.get("returnTo"),
    signedIn.config.appOrigin,
  );
  if (signedIn.aal === "aal2") throwRedirect(returnTo, signedIn.headers);
  const { data: factors, error } =
    await signedIn.supabase.auth.mfa.listFactors();
  if (error !== null) throwStatus(503, signedIn.headers);
  // listFactors().totp holds verified TOTP factors only.
  const verified = factors.totp[0];
  return data(
    {
      csrf: context.security.csrfToken,
      returnTo,
      challengeFactorId: verified?.id ?? null,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const form = await request.formData();
  const returnTo = returnPath(
    field(form, "returnTo"),
    signedIn.config.appOrigin,
  );
  const mfa = signedIn.supabase.auth.mfa;

  if (field(form, "intent") === "enrol") {
    const { data: factors, error: listError } = await mfa.listFactors();
    if (listError !== null)
      return data({ problem: "unavailable" as const }, { status: 503 });
    if (factors.totp.length > 0) {
      // Adding another factor needs aal2 first; Supabase enforces this too.
      return data({ problem: "already_enrolled" as const }, { status: 400 });
    }
    // Drop abandoned, never-verified enrolments before starting a new one.
    for (const stale of factors.all.filter((f) => f.status === "unverified")) {
      await mfa.unenroll({ factorId: stale.id });
    }
    const suffix = crypto.randomUUID().slice(0, 8);
    const { data: enrolled, error } = await mfa.enroll({
      factorType: "totp",
      friendlyName: `Authenticator ${suffix}`,
      issuer: "CarworX",
    });
    if (error !== null) {
      return data(
        { problem: "unavailable" as const },
        { status: 503, headers: signedIn.headers },
      );
    }
    return data(
      {
        enrolment: {
          factorId: enrolled.id,
          qrCode: enrolled.totp.qr_code,
          secret: enrolled.totp.secret,
        },
      },
      { headers: signedIn.headers },
    );
  }

  const factorId = field(form, "factorId");
  const code = parseTotpCode(form);
  if (!UUID.test(factorId) || code === null) {
    return data({ problem: "invalid_code" as const }, { status: 400 });
  }
  const { error } = await mfa.challengeAndVerify({ factorId, code });
  if (error !== null) {
    return data(
      { problem: "invalid_code" as const },
      { status: 400, headers: signedIn.headers },
    );
  }
  return redirect(returnTo, { headers: signedIn.headers });
}

function CodeForm({
  csrf,
  returnTo,
  factorId,
}: {
  csrf: string;
  returnTo: string;
  factorId: string;
}) {
  return (
    <Form method="post">
      <CsrfField token={csrf} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="intent" value="verify" />
      <input type="hidden" name="factorId" value={factorId} />
      <p>
        <label htmlFor="code">6-digit code from your authenticator app</label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
      </p>
      <button type="submit">Verify</button>
    </Form>
  );
}

export default function Mfa({ loaderData, actionData }: Route.ComponentProps) {
  const { csrf, returnTo, challengeFactorId } = loaderData;
  const enrolment =
    actionData && "enrolment" in actionData ? actionData.enrolment : undefined;
  const problem =
    actionData && "problem" in actionData ? actionData.problem : undefined;
  return (
    <AuthPage title="Two-step sign-in">
      {problem === "invalid_code" && (
        <Notice tone="error">
          <span data-problem="invalid_code">
            That code didn't work. Check your app and try again.
          </span>
        </Notice>
      )}
      {(problem === "unavailable" || problem === "already_enrolled") && (
        <Notice tone="error">
          <span data-problem={problem}>
            We couldn't set that up. Try again in a moment.
          </span>
        </Notice>
      )}
      {enrolment !== undefined ? (
        <>
          <p>
            Scan this code with your authenticator app, then enter the 6-digit
            code.
          </p>
          <img
            src={enrolment.qrCode}
            alt="QR code for your authenticator app"
            width={200}
            height={200}
          />
          <p>
            Or enter this key by hand:{" "}
            <code data-totp-secret={enrolment.secret}>{enrolment.secret}</code>
          </p>
          <CodeForm
            csrf={csrf}
            returnTo={returnTo}
            factorId={enrolment.factorId}
          />
        </>
      ) : challengeFactorId !== null ? (
        <CodeForm
          csrf={csrf}
          returnTo={returnTo}
          factorId={challengeFactorId}
        />
      ) : (
        <>
          <p>
            Add an authenticator app as a second step when you sign in. After a
            password, you'll enter a 6-digit code from the app. Admin accounts
            must have one.
          </p>
          <Form method="post">
            <CsrfField token={csrf} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="intent" value="enrol" />
            <button type="submit">Set up an authenticator app</button>
          </Form>
        </>
      )}
    </AuthPage>
  );
}
