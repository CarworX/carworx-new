import { data } from "react-router";

import { throwRedirect, throwStatus } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import { CatalogueUnavailable, listingById } from "../server/catalogue/public";
import {
  parseClaim,
  PROBLEM_TEXT,
  problemFrom,
  type Problem,
} from "../server/providers/forms";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.claim.$publicId";

export const meta: Route.MetaFunction = () => [
  { title: "Claim this listing · CarworX" },
];

async function liveListing(
  config: Parameters<typeof listingById>[0],
  publicId: string,
  headers: Headers,
) {
  try {
    const listing = await listingById(config, publicId);
    if (!listing) throwStatus(404, headers);
    return listing;
  } catch (error) {
    if (error instanceof CatalogueUnavailable) throwStatus(503, headers);
    throw error;
  }
}

/**
 * /provider/claim/:publicId: a signed-in person asks for control of a live
 * listing. Nothing transfers until an admin reviews it (Claude 17 §3).
 */
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const listing = await liveListing(
    signedIn.config,
    params.publicId,
    signedIn.headers,
  );
  const domain = (signedIn.user.email ?? "").split("@")[1] ?? "";
  return data(
    {
      csrf: context.security.csrfToken,
      listing: { public_id: listing.public_id, name: listing.display_name },
      domain,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const claim = parseClaim(await request.formData());
  const fail = (problem: Problem) =>
    data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  if (claim === null) return fail("invalid_input");
  const { error } = await signedIn.supabase.rpc("claim_listing", {
    p_listing: params.publicId,
    ...claim,
  });
  if (error !== null) return fail(problemFrom(error));
  return throwRedirect("/provider?claimed=1", signedIn.headers);
}

export default function Claim({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <h1 className="type-display-lg">Claim {loaderData.listing.name}</h1>
      <p className="type-body mt-3 max-w-[65ch]">
        If you run this business, you can ask to manage its listing. A CarworX
        admin reviews every claim first. If someone already manages it, they can
        dispute your claim.
      </p>
      {actionData?.problem ? (
        <div className="mt-4 max-w-[65ch]" data-problem={actionData.problem}>
          <StatusNote tone="err" title="We couldn't send your claim.">
            {PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        </div>
      ) : null}
      <form method="post" className="mt-6 grid max-w-[65ch] gap-4">
        <CsrfField token={loaderData.csrf} />
        <fieldset className="cx-field">
          <legend>How can we check it's yours?</legend>
          <label className="cx-check">
            <input
              type="radio"
              name="evidence"
              value="business_email"
              required
            />
            <span>
              My sign-in email is at the business's own domain (
              {loaderData.domain || "your domain"})
            </span>
          </label>
          <label className="cx-check">
            <input type="radio" name="evidence" value="document" />
            <span>I'll show an admin a document</span>
          </label>
        </fieldset>
        <TextField
          label="Document reference (documents only)"
          name="documentReference"
          maxLength={200}
          hint="For example, the date and type of a utility bill or registration letter. Don't upload or paste the document itself."
        />
        <div>
          <Button type="submit" variant="primary">
            Send claim
          </Button>
        </div>
      </form>
    </PublicShell>
  );
}
