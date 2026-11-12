import { data, redirect } from "react-router";

import { CsrfField } from "../auth/ui";
import { CATEGORIES, findCategory } from "../catalogue/taxonomy";
import { NOTICE_VERSION, parseDemand, PROVINCES } from "../server/forms/parse";
import { formAction, formHeaders } from "../server/forms/route.server";
import { siteKeyFor, type FormsEnv } from "../server/forms/submit";
import { Button, ButtonLink } from "../ui/Button";
import { ConsentCheckbox, TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { FormProblem } from "../ui/public/FormProblem";
import { HumanCheck } from "../ui/public/HumanCheck";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/demand";

export const meta: Route.MetaFunction = () => [
  { title: "Tell me when a provider joins · CarworX" },
  { name: "robots", content: "noindex" },
];

/**
 * /demand (P2-5, A13): private "need a provider here" capture from an empty
 * search. Email only, plus the service and province; never the search point
 * or the place typed (A17). Kept 12 months; read only by an admin at aal2.
 */
export function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const category = findCategory(url.searchParams.get("category") ?? "")?.slug;
  return data(
    {
      csrf: context.security.csrfToken,
      siteKey: siteKeyFor(
        context.cloudflare.env as FormsEnv,
        context.security.config,
      ),
      category: category ?? null,
      sent: url.searchParams.get("sent") === "1",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const headers: Route.HeadersFunction = formHeaders;

export async function action({ request, context }: Route.ActionArgs) {
  const problem = await formAction(
    request,
    context,
    "demand",
    parseDemand,
    (db, demand) => db.demand(demand, NOTICE_VERSION),
  );
  if (problem) return problem;
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw redirect("/demand?sent=1");
}

export default function Demand({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <PublicShell>
      <h1 className="type-display-lg max-sm:text-[34px] max-sm:leading-[36px]">
        Tell me when a provider joins
      </h1>
      <div className="mt-6 grid max-w-[65ch] gap-4">
        {loaderData.sent ? (
          <>
            <StatusNote tone="ok" title="Thanks, we've noted it.">
              We'll use it to find providers near you. To change your mind,
              contact support and we'll delete it.
            </StatusNote>
            <div>
              <ButtonLink href="/" variant="secondary">
                Back to search
              </ButtonLink>
            </div>
          </>
        ) : loaderData.siteKey === null ? (
          <StatusNote title="This form isn't available right now.">
            Please try again later.
          </StatusNote>
        ) : (
          <form method="post" className="grid gap-4" data-form="demand">
            <CsrfField token={loaderData.csrf} />
            <p className="type-body">
              We're adding providers area by area. Leave your email and we'll
              know there's a need here. We only ask for what we need.
            </p>
            <FormProblem
              problem={actionData?.problem}
              title="We couldn't save your request."
            />
            <div className="cx-field">
              <label htmlFor="demand-category">Service</label>
              <select
                id="demand-category"
                name="category"
                className="cx-input"
                required
                defaultValue={loaderData.category ?? ""}
              >
                <option value="" disabled>
                  Choose a service
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="cx-field">
              <label htmlFor="demand-province">Province</label>
              <select
                id="demand-province"
                name="province"
                className="cx-input"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a province
                </option>
                {PROVINCES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <TextField
              label="Your email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
            <ConsentCheckbox name="consent" required>
              Keep my email, the service and the province for 12 months so
              CarworX can tell me when a provider joins here. It isn't shown to
              anyone else, and it's stored on servers outside South Africa.
            </ConsentCheckbox>
            <HumanCheck siteKey={loaderData.siteKey} action="demand" />
            <div>
              <Button type="submit" variant="primary">
                Save my request
              </Button>
            </div>
          </form>
        )}
      </div>
    </PublicShell>
  );
}
