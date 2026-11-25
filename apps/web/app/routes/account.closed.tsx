/**
 * /account/closed: shown once the account is closed and signed out
 * everywhere (D-098). The date comes from the query (display only).
 */
import { PublicShell } from "../ui/public/PublicShell";
import "../account/settings.css";
import type { Route } from "./+types/account.closed";

export const meta: Route.MetaFunction = () => [
  { title: "Your account is closed · CarworX" },
  { name: "robots", content: "noindex" },
];

export function loader({ request }: Route.LoaderArgs) {
  const on = new URL(request.url).searchParams.get("on") ?? "";
  return {
    on: /^\d{4}-\d{2}-\d{2}$/.test(on)
      ? new Intl.DateTimeFormat("en-ZA", {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Africa/Johannesburg",
        }).format(new Date(`${on}T12:00:00Z`))
      : null,
  };
}

export default function Closed({ loaderData }: Route.ComponentProps) {
  return (
    <PublicShell>
      <div className="cx-account-settings">
        <section className="cx-account-box" data-closed>
          <h1 className="type-heading">Your account is closed</h1>
          <p>
            {`You've been signed out on every device. Your data is kept for 14 days and then deleted${loaderData.on ? ` on ${loaderData.on}` : ""}. We'll email you when it's done.`}
          </p>
          <p>
            Changed your mind? Sign in before then and confirm that you want to
            keep your account.
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
