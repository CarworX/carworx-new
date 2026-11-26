/**
 * /fines/verify: confirm your ID before your traffic fines show (A6, B-21).
 *
 * The screen is decided from my_identity_status (fines/identity-view.ts). The
 * webhook decides the result; the redirect back from Didit never does, so the
 * checking screen polls this page until the server says otherwise.
 */
import { useEffect, useState } from "react";
import { data, Link, useRevalidator } from "react-router";

import { throwRedirect } from "../auth/http.server";
import { requireSignedIn, type SignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  identityView,
  MAX_TRIES,
  parseIdentityRow,
  type IdentityView,
} from "../fines/identity-view";
import { createIdentitySession } from "../server/identity/didit.server";
import { Button } from "../ui/Button";
import { ConsentCheckbox } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { useHydrated } from "../ui/useHydrated";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/fines.verify";

export const meta: Route.MetaFunction = () => [
  { title: "Confirm it's you · CarworX" },
  { name: "robots", content: "noindex" },
];

const VERIFY_PATH = "/fines/verify";
/** How often the checking screen asks the server for the result. */
const POLL_MS = 5000;

async function readView(auth: SignedIn): Promise<IdentityView> {
  const result: { data: unknown; error: unknown } =
    await auth.supabase.rpc("my_identity_status");
  return identityView(parseIdentityRow(result));
}

/** The first name from Google or the sign-up name, when there is one. */
function firstNameOf(auth: SignedIn): string | null {
  const meta = auth.user.user_metadata as Record<string, unknown> | undefined;
  const full = meta?.["full_name"] ?? meta?.["name"];
  if (typeof full !== "string" || full.trim() === "") return null;
  return full.trim().split(/\s+/)[0] ?? null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const auth = await requireSignedIn(request, context.security);
  auth.headers.set("Cache-Control", "private, no-store");
  return data(
    {
      csrf: context.security.csrfToken,
      view: await readView(auth),
      firstName: firstNameOf(auth),
    },
    { headers: auth.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = context.cloudflare.env;
  const auth = await requireSignedIn(request, context.security);
  auth.headers.set("Cache-Control", "private, no-store");
  const form = await request.formData();
  if (form.get("intent") !== "start" || form.get("consent") !== "on")
    return data({ problem: "consent" }, { status: 400, headers: auth.headers });
  let url: string;
  try {
    ({ url } = await createIdentitySession(env, auth.user.id, VERIFY_PATH));
  } catch {
    // Unavailable (not configured here, or the provider did not answer): say so,
    // and do not start a second check.
    return data(
      { problem: "unavailable" },
      { status: 409, headers: auth.headers },
    );
  }
  throwRedirect(url, auth.headers);
}

/** The consent box and the start button; the button waits for the box. */
function StartForm({ csrf, label }: { csrf: string; label: string }) {
  const [ticked, setTicked] = useState(false);
  const hydrated = useHydrated();
  return (
    <form method="post" className="cx-verify-start">
      <CsrfField token={csrf} />
      <input type="hidden" name="intent" value="start" />
      <ConsentCheckbox
        name="consent"
        required
        onChange={(checked) => {
          setTicked(checked);
        }}
      >
        I agree that Didit may check my ID and selfie for CarworX, and that
        CarworX may use the result to look up my traffic fines.
      </ConsentCheckbox>
      <Button
        type="submit"
        variant="primary"
        block
        disabled={hydrated && !ticked}
      >
        {label}
      </Button>
      {!ticked ? (
        <p className="type-caption">Tick the box above to continue.</p>
      ) : null}
    </form>
  );
}

export default function VerifyFines({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { view, csrf, firstName } = loaderData;
  const revalidator = useRevalidator();

  // While the check runs, ask the server again; the webhook decides the result.
  useEffect(() => {
    if (view.kind !== "checking" && view.kind !== "in_review") return;
    const timer = setInterval(() => {
      void revalidator.revalidate();
    }, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [view.kind, revalidator]);

  const problem = actionData?.problem;
  return (
    <PublicShell signedIn>
      <section className="cx-verify" aria-labelledby="verify-h">
        {problem === "consent" ? (
          <StatusNote tone="err" title="Tick the box to continue.">
            We need your agreement before Didit checks your ID.
          </StatusNote>
        ) : null}
        {problem === "unavailable" ? (
          <StatusNote tone="err" title="We couldn't start a new ID check.">
            Try again in a moment, or contact support.
          </StatusNote>
        ) : null}

        {view.kind === "intro" ? (
          <>
            <p className="type-eyebrow">Traffic fines</p>
            <h1 id="verify-h">Confirm it&apos;s you.</h1>
            <p className="lede">Once, then your fines show here.</p>
            <p>
              Traffic fines are linked to your ID number, so we need to know
              it&apos;s really you before we show them. It takes about two
              minutes on your phone.
            </p>
            <ol className="cx-verify-steps">
              <li>
                <strong>Photograph your ID</strong>
                <span>
                  Front of your smart ID card, the photo page of your green ID
                  book, or your driver&apos;s licence card.
                </span>
              </li>
              <li>
                <strong>Take a quick selfie</strong>
                <span>
                  A short video check that you&apos;re a real person, matched to
                  the photo on your ID.
                </span>
              </li>
              <li>
                <strong>Come back here</strong>
                <span>
                  Most checks finish in under a minute. Your fines appear
                  straight after.
                </span>
              </li>
            </ol>
            <p className="type-caption">
              Smart ID card · Green ID book · Driver&apos;s licence
            </p>
            <StatusNote title="Your photos stay with our verification partner.">
              Both steps happen on the secure screen of Didit, our verification
              partner. Didit checks the document, that you&apos;re really there,
              and that your face matches. CarworX never receives or stores your
              ID photo or selfie. We keep only the result and the last 4 digits
              of your ID number, and use them only to find and pay your fines.
              They are never shown to businesses.
            </StatusNote>
            <StartForm csrf={csrf} label="Start verification" />
            <p className="type-caption">
              Opens Didit&apos;s secure screen. On a computer, you can scan a
              code to continue on your phone.
            </p>
          </>
        ) : null}

        {view.kind === "checking" ? (
          <>
            <h1 id="verify-h">Checking…</h1>
            <p>
              {firstName !== null ? `Thanks, ${firstName}. ` : "Thanks. "}
              This usually takes under a minute. This page updates by itself, so
              you can leave it and come back to see the result.
            </p>
            <ol className="cx-verify-steps" aria-label="Progress">
              <li>
                <strong>ID photographed</strong>
              </li>
              <li>
                <strong>Selfie taken</strong>
              </li>
              <li>
                <strong>Didit is checking</strong>
              </li>
            </ol>
          </>
        ) : null}

        {view.kind === "approved" ? (
          <>
            <h1 id="verify-h">You&apos;re verified.</h1>
            <p>Your ID is confirmed. We&apos;re looking up your fines now.</p>
            <StatusNote tone="ok" title="Done once, for good.">
              You won&apos;t need to do this again unless you change your ID
              number.
            </StatusNote>
            <Link className="cx-btn primary" to="/fines/mine">
              See my fines
            </Link>
          </>
        ) : null}

        {view.kind === "in_review" ? (
          <>
            <h1 id="verify-h">A person is checking it.</h1>
            <p>
              Didit passed most checks but asked for a second look. Usually
              within one business day.
            </p>
            <ol className="cx-verify-steps" aria-label="Progress">
              <li>
                <strong>Photos taken on Didit</strong>
              </li>
              <li>
                <strong>Automatic checks</strong>
                <span>One needs a second look.</span>
              </li>
              <li>
                <strong>Our team decides</strong>
                <span>You&apos;ll see the result on this page.</span>
              </li>
            </ol>
          </>
        ) : null}

        {view.kind === "declined" ? (
          <>
            <h1 id="verify-h">We couldn&apos;t confirm your ID.</h1>
            <p>
              Nothing is wrong with your account. It usually works on the next
              try.
            </p>
            <StatusNote tone="err" title="Why">
              {view.reason}
            </StatusNote>
            <p className="cx-tries">
              Try {view.used} of {MAX_TRIES} used · {view.left} left
            </p>
            <StartForm csrf={csrf} label="Try again" />
            <Link className="cx-btn outline" to="/support">
              Contact support
            </Link>
          </>
        ) : null}

        {view.kind === "locked" ? (
          <>
            <h1 id="verify-h">
              We couldn&apos;t confirm it after {MAX_TRIES} tries.
            </h1>
            <p>Our team will help you finish it another way.</p>
            <StatusNote tone="err" title="Why">
              {view.reason}
            </StatusNote>
            <p className="cx-tries">
              {MAX_TRIES} of {MAX_TRIES} tries used
            </p>
            <Link className="cx-btn primary" to="/support">
              Contact support
            </Link>
            <Link className="cx-btn outline" to="/">
              Back to home
            </Link>
          </>
        ) : null}
      </section>
    </PublicShell>
  );
}
