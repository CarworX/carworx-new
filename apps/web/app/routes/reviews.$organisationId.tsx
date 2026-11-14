import { data } from "react-router";
import { authRequest, getSignedIn, signInUrl } from "../auth/session.server";
import { throwStatus } from "../auth/http.server";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/reviews.$organisationId";
interface Review {
  stars: number;
  review: string;
}
export async function loader({ request, params, context }: Route.LoaderArgs) {
  // Reviews are signed-in only for now: anon may read only the public
  // catalogue projection, and reviews are not in it yet (owner, 14 Nov 2026).
  const a =
    (await getSignedIn(request, context.security)) ??
    authRequest(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      params.organisationId,
    )
  )
    throwStatus(404, a.headers);
  if (!("user" in a))
    return data(
      {
        items: [] as Review[],
        signIn: signInUrl(request, a.config.appOrigin),
      },
      { headers: a.headers },
    );
  const r = await a.supabase.rpc("organisation_reviews", {
    p_org: params.organisationId,
  });
  if (r.error !== null) throwStatus(503, a.headers);
  const items = Array.isArray(r.data)
    ? r.data.filter(
        (x: unknown): x is Review =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as Review).stars === "number" &&
          typeof (x as Review).review === "string",
      )
    : [];
  return data({ items, signIn: null }, { headers: a.headers });
}
export default function Reviews({
  loaderData: { items, signIn },
}: Route.ComponentProps) {
  return (
    <PublicShell>
      <h1>Customer reviews</h1>
      <p>
        Moderated reviews from completed bookings. Reviewer identities are
        private.
      </p>
      {signIn !== null ? (
        <p>
          <a href={signIn}>Sign in</a> to read this business&apos;s reviews.
        </p>
      ) : items.length === 0 ? (
        <p>No published reviews yet.</p>
      ) : (
        items.map((r, i) => (
          <article className="mt-6" key={i}>
            <h2>{r.stars} of 5</h2>
            <p className="whitespace-pre-wrap">{r.review}</p>
          </article>
        ))
      )}
    </PublicShell>
  );
}
