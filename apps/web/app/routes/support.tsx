import { data, redirect } from "react-router";

import { CsrfField } from "../auth/ui";
import { parseSupport, TOPICS } from "../server/forms/parse";
import { formAction, formHeaders } from "../server/forms/route.server";
import { siteKeyFor, type FormsEnv } from "../server/forms/submit";
import { Button } from "../ui/Button";
import { TextField } from "../ui/Field";
import { StatusNote } from "../ui/Note";
import { FormProblem } from "../ui/public/FormProblem";
import { HumanCheck } from "../ui/public/HumanCheck";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/support";

export const meta: Route.MetaFunction = () => [
  { title: "Contact support · CarworX" },
];

/** /support (P2-5): a support case, including privacy requests. */
export function loader({ request, context }: Route.LoaderArgs) {
  return data(
    {
      csrf: context.security.csrfToken,
      siteKey: siteKeyFor(
        context.cloudflare.env as FormsEnv,
        context.security.config,
      ),
      sent: new URL(request.url).searchParams.get("sent") === "1",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export const headers: Route.HeadersFunction = formHeaders;

export async function action({ request, context }: Route.ActionArgs) {
  const problem = await formAction(
    request,
    context,
    "support",
    parseSupport,
    (db, support) => db.support(support),
  );
  if (problem) return problem;
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw redirect("/support?sent=1");
}

export default function Support({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <PublicShell>
      <h1 className="type-display-lg">Contact support</h1>
      <div className="mt-6 grid max-w-[65ch] gap-4">
        {loaderData.sent ? (
          <StatusNote tone="ok" title="Message received.">
            A CarworX admin will read it and reply to your email.
          </StatusNote>
        ) : loaderData.siteKey === null ? (
          <StatusNote title="This form isn't available right now.">
            Please try again later.
          </StatusNote>
        ) : (
          <form method="post" className="grid gap-4" data-form="support">
            <CsrfField token={loaderData.csrf} />
            <FormProblem
              problem={actionData?.problem}
              title="We couldn't send your message."
            />
            <div className="cx-field">
              <label htmlFor="support-topic">What's it about?</label>
              <select
                id="support-topic"
                name="topic"
                className="cx-input"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a topic
                </option>
                {TOPICS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
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
              hint="We reply to this address. We keep the case for 3 years after it's closed."
            />
            <div className="cx-field">
              <label htmlFor="support-message">Your message</label>
              <textarea
                id="support-message"
                name="message"
                className="cx-input"
                required
                minLength={10}
                maxLength={2000}
                rows={6}
                aria-describedby="support-message-hint"
              />
              <span id="support-message-hint" className="hint">
                Don't include ID numbers, passwords or bank details.
              </span>
            </div>
            <HumanCheck siteKey={loaderData.siteKey} action="support" />
            <div>
              <Button type="submit" variant="primary">
                Send message
              </Button>
            </div>
          </form>
        )}
      </div>
    </PublicShell>
  );
}
