import { data, Form } from "react-router";
import { field } from "../auth/forms";
import { CLAIM_DOCUMENTS, claimDocumentReference } from "../onboarding/claim";

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
import { Button, QuietLink } from "../ui/Button";
import { ChoiceTiles } from "../ui/Choice";
import { SegmentedProgress } from "../ui/SegmentedProgress";
import { StepRail, type RailStep } from "../ui/StepRail";
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
  const step =
    new URL(request.url).searchParams.get("step") === "proof"
      ? "proof"
      : "business";
  signedIn.headers.set("Cache-Control", "private, no-store");
  return data(
    {
      csrf: context.security.csrfToken,
      listing: { public_id: listing.public_id, name: listing.display_name },
      domain,
      step,
    },
    { headers: signedIn.headers },
  );
}

export async function action({ request, params, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  signedIn.headers.set("Cache-Control", "private, no-store");
  const form = await request.formData();
  const intent = field(form, "intent");
  const fail = (problem: Problem) =>
    data(
      { problem, review: null },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  if (intent !== "" && intent !== "review" && intent !== "submit")
    return fail("invalid_input");
  if (intent === "review" && field(form, "evidence") === "document") {
    const reference = claimDocumentReference(form);
    if (!reference) return fail("invalid_input");
    form.set("documentReference", reference);
  }
  const claim = parseClaim(form);
  if (!claim) return fail("invalid_input");
  if (intent === "review")
    return data(
      { problem: null, review: claim },
      { headers: signedIn.headers },
    );
  const { error } = await signedIn.supabase.rpc("claim_listing", {
    p_listing: params.publicId,
    ...claim,
  });
  if (error) return fail(problemFrom(error));
  return throwRedirect("/provider?claimed=1", signedIn.headers);
}

const CLAIM_RAIL: readonly RailStep[] = [
  { title: "Business", body: "Confirm the listing", icon: "home" },
  { title: "Proof", body: "Choose how we check it", icon: "shield" },
  { title: "Check", body: "Review and send", icon: "check" },
];
export const headers: Route.HeadersFunction = () => ({
  "Cache-Control": "private, no-store",
});

export default function Claim({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const review = actionData?.review;
  const step = review ? "check" : loaderData.step;
  const current = step === "business" ? 0 : step === "proof" ? 1 : 2;
  const href = `/provider/claim/${loaderData.listing.public_id}`;
  const year = new Date().getUTCFullYear();
  return (
    <PublicShell signedIn>
      <h1 className="type-display-lg">Claim {loaderData.listing.name}</h1>
      <p className="type-body mt-3 max-w-[65ch]">
        If you run this business, you can ask to manage its listing. An admin
        reviews every claim first. If someone already manages it, they can
        dispute your claim.
      </p>
      <p className="type-caption mt-3">
        Your signed-in email domain: {loaderData.domain || "not available"}.
        Nothing transfers when you send this claim.
      </p>
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <StepRail steps={CLAIM_RAIL} current={current} label="Claim steps" />
        </aside>
        <div className="grid max-w-[65ch] gap-5">
          <SegmentedProgress
            step={current}
            total={3}
            name={CLAIM_RAIL[current]?.title ?? "Business"}
            label="Claim progress"
          />
          {actionData?.problem ? (
            <div data-problem={actionData.problem}>
              <StatusNote tone="err" title="We couldn't send your claim.">
                {PROBLEM_TEXT[actionData.problem]}
              </StatusNote>
            </div>
          ) : null}
          {step === "business" ? (
            <section className="grid gap-4 rounded-2xl bg-white p-5">
              <h2 className="type-display-md">Is this your business?</h2>
              <p>{loaderData.listing.name}</p>
              <p>
                Choose how we can verify that you are authorised to manage it.
                You won't need to type or upload a document.
              </p>
              <QuietLink href={`/p/${loaderData.listing.public_id}`}>
                View the listing
              </QuietLink>
              <div className="flex flex-wrap justify-between gap-3">
                <QuietLink href="/provider">Back</QuietLink>
                <QuietLink href={`${href}?step=proof`}>
                  Continue to proof
                </QuietLink>
              </div>
            </section>
          ) : null}
          {step === "proof" ? (
            <Form
              method="post"
              action={href}
              className="grid gap-5 rounded-2xl bg-white p-5"
            >
              <CsrfField token={loaderData.csrf} />
              <input type="hidden" name="intent" value="review" />
              <ChoiceTiles
                legend="How can we check it's yours?"
                name="evidence"
                required
                defaultValue="business_email"
                options={[
                  {
                    value: "business_email",
                    title: "Business email",
                    description: `My sign-in email is at the business's own domain (${loaderData.domain || "your domain"})`,
                  },
                  {
                    value: "document",
                    title: "Business document",
                    description: "I'll show an admin a document",
                  },
                ]}
              />
              <fieldset className="cx-field grid gap-3">
                <legend>
                  For a business document, choose its type and date
                </legend>
                <label className="cx-field">
                  <span className="lbl">Document type</span>
                  <select
                    className="cx-input"
                    name="documentType"
                    defaultValue=""
                  >
                    <option value="">Choose a document</option>
                    {CLAIM_DOCUMENTS.map((document) => (
                      <option key={document.value} value={document.value}>
                        {document.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="cx-field">
                    <span className="lbl">Year</span>
                    <select
                      className="cx-input"
                      name="documentYear"
                      defaultValue=""
                    >
                      <option value="">Year</option>
                      {Array.from(
                        { length: year - 1899 },
                        (_, index) => year - index,
                      ).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cx-field">
                    <span className="lbl">Month</span>
                    <select
                      className="cx-input"
                      name="documentMonth"
                      defaultValue=""
                    >
                      <option value="">Month</option>
                      {Array.from({ length: 12 }, (_, index) =>
                        String(index + 1).padStart(2, "0"),
                      ).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="cx-field">
                    <span className="lbl">Day</span>
                    <select
                      className="cx-input"
                      name="documentDay"
                      defaultValue=""
                    >
                      <option value="">Day</option>
                      {Array.from({ length: 31 }, (_, index) =>
                        String(index + 1).padStart(2, "0"),
                      ).map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="hint">
                  Only the type and date are saved as a reference. Don't upload
                  or paste the document itself.
                </p>
              </fieldset>
              <div className="flex flex-wrap justify-between gap-3">
                <QuietLink href={href}>Back</QuietLink>
                <Button type="submit" variant="primary">
                  Review claim
                </Button>
              </div>
            </Form>
          ) : null}
          {review ? (
            <Form
              method="post"
              action={href}
              className="grid gap-5 rounded-2xl bg-white p-5"
            >
              <CsrfField token={loaderData.csrf} />
              <input type="hidden" name="intent" value="submit" />
              <input type="hidden" name="evidence" value={review.p_evidence} />
              {review.p_document_reference ? (
                <input
                  type="hidden"
                  name="documentReference"
                  value={review.p_document_reference}
                />
              ) : null}
              <h2 className="type-display-md">Is this right?</h2>
              <p>{loaderData.listing.name}</p>
              <p>
                {review.p_evidence === "business_email"
                  ? `Check my signed-in business email at ${loaderData.domain}`
                  : review.p_document_reference}
              </p>
              <p>
                An admin will review this proof. Sending it does not transfer
                ownership.
              </p>
              <div className="flex flex-wrap justify-between gap-3">
                <QuietLink href={`${href}?step=proof`}>Change proof</QuietLink>
                <Button type="submit" variant="primary">
                  Send claim
                </Button>
              </div>
            </Form>
          ) : null}
        </div>
      </div>
    </PublicShell>
  );
}
