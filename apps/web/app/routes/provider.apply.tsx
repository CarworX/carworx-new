import { data } from "react-router";

import { throwRedirect } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import { CsrfField } from "../auth/ui";
import {
  parseApplication,
  PROBLEM_TEXT,
  problemFrom,
  SERVICE_OPTIONS,
  type Problem,
} from "../server/providers/forms";
import { Button } from "../ui/Button";
import { ConsentCheckbox, TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/provider.apply";

export const meta: Route.MetaFunction = () => [
  { title: "List your business · CarworX" },
];

/** /provider/apply: any signed-in person can apply; an admin reviews it (D-023). */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  return data(
    { csrf: context.security.csrfToken },
    { headers: signedIn.headers },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  const application = parseApplication(await request.formData());
  if (application === null)
    return data(
      { problem: "invalid_input" as Problem },
      { status: 400, headers: signedIn.headers },
    );
  const { error } = await signedIn.supabase.rpc("provider_apply", application);
  if (error !== null) {
    const problem = problemFrom(error);
    return data(
      { problem },
      {
        status: problem === "unavailable" ? 503 : 400,
        headers: signedIn.headers,
      },
    );
  }
  return throwRedirect("/provider?applied=1", signedIn.headers);
}

export default function Apply({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <PublicShell signedIn>
      <h1 className="type-display-lg">List your business</h1>
      <p className="type-body mt-3 max-w-[65ch]">
        Tell us about your business. A CarworX admin checks every application
        before it appears in search, and records how they checked it.
      </p>
      {actionData?.problem ? (
        <div className="mt-4 max-w-[65ch]" data-problem={actionData.problem}>
          <StatusNote tone="err" title="We couldn't send your application.">
            {PROBLEM_TEXT[actionData.problem]}
          </StatusNote>
        </div>
      ) : null}
      <form method="post" className="mt-6 grid max-w-[65ch] gap-4">
        <CsrfField token={loaderData.csrf} />
        <TextField
          label="Business name"
          name="businessName"
          required
          minLength={2}
          maxLength={160}
        />
        <div className="cx-field">
          <label htmlFor="service">Main service</label>
          <select id="service" name="service" className="cx-input" required>
            {SERVICE_OPTIONS.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="cx-field">
          <legend>How do you work?</legend>
          <label className="cx-check">
            <input type="radio" name="mode" value="fixed" required />
            <span>Customers come to my workshop</span>
          </label>
          <label className="cx-check">
            <input type="radio" name="mode" value="mobile" />
            <span>I go to customers (mobile)</span>
          </label>
        </fieldset>
        <TextField
          label="Area or metro"
          name="metro"
          required
          minLength={2}
          maxLength={120}
          hint="For example, Gauteng or Cape Town."
        />
        <div className="cx-field">
          <label htmlFor="description">What you do</label>
          <textarea
            id="description"
            name="description"
            className="cx-input"
            required
            minLength={10}
            maxLength={2000}
            rows={4}
          />
        </div>
        <TextField
          label="Workshop address (workshops only)"
          name="address"
          maxLength={300}
          hint="Shown on your listing. Leave empty if you're mobile."
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Latitude"
            name="latitude"
            inputMode="decimal"
            required
            hint="For example, -26.2041"
          />
          <TextField
            label="Longitude"
            name="longitude"
            inputMode="decimal"
            required
            hint="For example, 28.0473"
          />
        </div>
        <TextField
          label="How far you travel, in km (mobile only)"
          name="radiusKm"
          inputMode="numeric"
          hint="Mobile only: your base and distance are kept private and never shown."
        />
        <ConsentCheckbox name="confirm" required>
          These details are true, and I may list this business.
        </ConsentCheckbox>
        <div>
          <Button type="submit" variant="primary">
            Send application
          </Button>
        </div>
      </form>
    </PublicShell>
  );
}
