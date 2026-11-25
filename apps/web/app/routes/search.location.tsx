import { data, Form, Link } from "react-router";
import { AuthPage, CsrfField } from "../auth/ui";
import {
  discoverLocations,
  privateLocationHeaders,
} from "../server/geo/discovery.server";
import type { Route } from "./+types/search.location";

export function loader({ context }: Route.LoaderArgs) {
  return { csrf: context.security.csrfToken };
}

export function headers({ actionHeaders }: Route.HeadersArgs) {
  const result = new Headers(actionHeaders);
  result.set("Cache-Control", privateLocationHeaders["Cache-Control"]);
  return result;
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.clone().formData();
  const words = form.get("q");
  const { candidates, status, headers } = await discoverLocations(
    request,
    context.cloudflare.env,
    false,
  );
  return data(
    {
      candidates,
      status,
      words: typeof words === "string" ? words.slice(0, 60) : "",
    },
    { status, headers },
  );
}

export default function SearchLocation({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  return (
    <AuthPage title="Search by address or town">
      <Form method="post">
        <CsrfField token={loaderData.csrf} />
        <label className="cx-field">
          Address, suburb, town or city
          <input className="cx-input" name="location" maxLength={80} required />
        </label>
        <label className="cx-field">
          Service or business name (optional)
          <input
            className="cx-input"
            name="q"
            maxLength={60}
            defaultValue={actionData?.words}
          />
        </label>
        <button className="cx-btn primary wide" type="submit">
          Find locations
        </button>
      </Form>
      {actionData &&
        (actionData.candidates.length === 0 ? (
          <p role="status">
            {actionData.status === 200
              ? "No locations found. Try a nearby town or check the spelling."
              : "Location search is unavailable for that request. Try again or browse without a location."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {actionData.candidates.map((candidate, index) => {
              const query = new URLSearchParams({
                lat: String(candidate.lat),
                lng: String(candidate.lng),
              });
              if (candidate.locality) query.set("near", candidate.locality);
              if (actionData.words) query.set("q", actionData.words);
              return (
                <li key={`${candidate.label}-${String(index)}`}>
                  <Link to={`/search?${query}`}>{candidate.label}</Link>
                </li>
              );
            })}
          </ul>
        ))}
      <Link to="/search">Browse without a location</Link>
    </AuthPage>
  );
}
