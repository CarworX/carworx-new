import { data } from "react-router";
import { authRequest } from "../auth/session.server";
import { PublicShell } from "../ui/public/PublicShell";
import type { Route } from "./+types/reviews.$organisationId";
interface Review {
  stars: number;
  review: string;
}
export async function loader({ request, params, context }: Route.LoaderArgs) {
  const a = authRequest(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      params.organisationId,
    )
  )
    throw new Response(null, { status: 404, headers: a.headers });
  const r = await a.supabase.rpc("organisation_reviews", {
    p_org: params.organisationId,
  });
  if (r.error !== null)
    throw new Response(null, { status: 503, headers: a.headers });
  const items = Array.isArray(r.data)
    ? r.data.filter(
        (x: unknown): x is Review =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as Review).stars === "number" &&
          typeof (x as Review).review === "string",
      )
    : [];
  return data({ items }, { headers: a.headers });
}
export default function Reviews({
  loaderData: { items },
}: Route.ComponentProps) {
  return (
    <PublicShell>
      <h1>Customer reviews</h1>
      <p>
        Moderated reviews from completed bookings. Reviewer identities are
        private.
      </p>
      {items.length === 0 ? (
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
