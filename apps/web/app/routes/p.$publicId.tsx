import { data, redirect } from "react-router";

import { topCategoryOf } from "../catalogue/taxonomy";
import { CsrfField } from "../auth/ui";
import { CatalogueUnavailable, listingById } from "../server/catalogue/public";
import { NOTICE_VERSION, parseEnquiry } from "../server/forms/parse";
import { formAction, formHeaders } from "../server/forms/route.server";
import { siteKeyFor, type FormsEnv } from "../server/forms/submit";
import { Button, TextLink } from "../ui/Button";
import { StatusLabel } from "../ui/Chip";
import { ConsentCheckbox, TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { FormProblem } from "../ui/public/FormProblem";
import { HumanCheck } from "../ui/public/HumanCheck";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/p.$publicId";

function unavailable(): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw data(null, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const config = context.security.config;
  if (!config) unavailable();
  let listing;
  try {
    listing = await listingById(config, params.publicId);
  } catch (error) {
    if (error instanceof CatalogueUnavailable) unavailable();
    throw error;
  }
  if (!listing) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
    throw data(null, { status: 404 });
  }
  // The page carries a CSRF token in its enquiry form, so it is never cached.
  return data(
    {
      listing,
      csrf: context.security.csrfToken,
      siteKey: siteKeyFor(context.cloudflare.env as FormsEnv, config),
      sent: new URL(request.url).searchParams.get("sent") === "1",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Enquiry (P2-5): limiter -> parse -> Turnstile -> forms_server. */
export async function action({ request, params, context }: Route.ActionArgs) {
  const problem = await formAction(
    request,
    context,
    "enquiry",
    parseEnquiry,
    (db, enquiry) => db.enquiry(params.publicId, enquiry, NOTICE_VERSION),
  );
  if (problem) return problem;
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw redirect(`/p/${params.publicId}?sent=1#enquiry`);
}

export const headers: Route.HeadersFunction = formHeaders;

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    {
      title: `${loaderData.listing.display_name} · CarworX`,
    },
  ];
}

export default function ListingPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { listing } = loaderData;
  const category = topCategoryOf(listing.category_slug);
  return (
    <PublicShell>
      <p className="cx-eyebrow">
        {category ? (
          <TextLink href={`/c/${category.slug}`}>{category.label}</TextLink>
        ) : null}
        {category ? " · " : null}
        {listing.service_name}
      </p>
      <h1 className="type-display-lg mt-2">{listing.display_name}</h1>
      {listing.verification_labels.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.verification_labels.map((label) => (
            <StatusLabel key={label}>{label}</StatusLabel>
          ))}
        </div>
      ) : null}
      <p className="type-body mt-4 max-w-[65ch]">{listing.description}</p>
      <div className="mt-6 max-w-[65ch]">
        {listing.mode === "fixed" ? (
          <StatusNote title="Visit the workshop.">
            {listing.public_address} · {listing.metro}
          </StatusNote>
        ) : (
          <StatusNote title="Comes to you.">
            Serves an area in {listing.metro}. Coverage is approximate; the
            provider confirms your exact address before any booking.
          </StatusNote>
        )}
      </div>
      <p className="mt-6">
        <TextLink href={`/provider/claim/${listing.public_id}`}>
          Is this your business? Claim this listing
        </TextLink>
      </p>
      <section
        id="enquiry"
        aria-labelledby="enquiry-h"
        className="mt-10 grid max-w-[65ch] gap-4"
      >
        <h2 id="enquiry-h" className="type-heading">
          Send {listing.display_name} a message
        </h2>
        {loaderData.sent ? (
          <StatusNote tone="ok" title="Message sent.">
            We've passed it to {listing.display_name}. They'll reply to the
            email you gave.
          </StatusNote>
        ) : loaderData.siteKey === null ? (
          <StatusNote title="Messages aren't available right now.">
            Please try again later.
          </StatusNote>
        ) : (
          <EnquiryForm
            csrf={loaderData.csrf}
            siteKey={loaderData.siteKey}
            provider={listing.display_name}
            problem={actionData?.problem}
          />
        )}
      </section>
    </PublicShell>
  );
}

function EnquiryForm({
  csrf,
  siteKey,
  provider,
  problem,
}: {
  csrf: string;
  siteKey: string;
  provider: string;
  problem: Parameters<typeof FormProblem>[0]["problem"];
}) {
  return (
    <form method="post" className="grid gap-4" data-form="enquiry">
      <CsrfField token={csrf} />
      <FormProblem problem={problem} title="We couldn't send your message." />
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        required
        minLength={2}
        maxLength={80}
      />
      <TextField
        label="Your email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        hint="The provider replies to this address."
      />
      <div className="cx-field">
        <label htmlFor="enquiry-message">Your message</label>
        <textarea
          id="enquiry-message"
          name="message"
          className="cx-input"
          required
          minLength={10}
          maxLength={1000}
          rows={5}
          aria-describedby="enquiry-message-hint"
        />
        <span id="enquiry-message-hint" className="hint">
          Say what you need. Don't include ID numbers or bank details.
        </span>
      </div>
      <ConsentCheckbox name="consent" required>
        Share my name, email and message with {provider} so they can reply.
        CarworX keeps a copy for 12 months, on servers outside South Africa.
      </ConsentCheckbox>
      <HumanCheck siteKey={siteKey} action="enquiry" />
      <div>
        <Button type="submit" variant="primary">
          Send message
        </Button>
      </div>
    </form>
  );
}
