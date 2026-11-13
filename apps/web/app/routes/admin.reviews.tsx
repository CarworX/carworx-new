import { data, Form } from "react-router";
import { requireAdmin } from "../server/providers/admin.server";
import { throwStatus } from "../auth/http.server";
import { CsrfField } from "../auth/ui";
import { AdminShell } from "../ui/admin/AdminShell";
import { Button } from "../ui/Button";
import type { Route } from "./+types/admin.reviews";
interface Item {
  id: string;
  stars: number;
  raw_text: string | null;
}
export async function loader({ request, context }: Route.LoaderArgs) {
  const a = await requireAdmin(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  a.headers.set("Referrer-Policy", "no-referrer");
  const r = await a.supabase.rpc("review_queue");
  if (r.error !== null) throwStatus(503, a.headers);
  const items = Array.isArray(r.data)
    ? r.data.filter(
        (x: unknown): x is Item =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as Item).id === "string" &&
          typeof (x as Item).stars === "number" &&
          ((x as Item).raw_text === null ||
            typeof (x as Item).raw_text === "string"),
      )
    : [];
  return data(
    { items, csrf: context.security.csrfToken },
    { headers: a.headers },
  );
}
export async function action({ request, context }: Route.ActionArgs) {
  const a = await requireAdmin(request, context.security);
  a.headers.set("Cache-Control", "private, no-store");
  const f = await request.formData(),
    id = f.get("id"),
    decision = f.get("decision"),
    text = f.get("text");
  if (
    typeof id !== "string" ||
    !/^[a-f0-9-]{36}$/.test(id) ||
    (decision !== "published" && decision !== "rejected") ||
    typeof text !== "string" ||
    text.length > 2000
  )
    return data({ ok: false }, { status: 400, headers: a.headers });
  const r = await a.supabase.rpc("moderate_booking_review", {
    p_review: id,
    p_decision: decision,
    p_public_text: text,
    p_deidentified: f.get("deidentified") === "yes",
  });
  return data(
    { ok: r.error === null },
    { status: r.error === null ? 200 : 409, headers: a.headers },
  );
}
export default function Reviews({
  loaderData: d,
  actionData: a,
}: Route.ComponentProps) {
  return (
    <AdminShell title="Review moderation">
      <p>
        Publish only de-identified text. Remove names, contact details, precise
        locations, registration numbers and other identifying details.
      </p>
      {d.items.length === 0 ? (
        <p>No reviews waiting.</p>
      ) : (
        d.items.map((r) => (
          <section className="mt-6" key={r.id}>
            <h2>{r.stars} of 5</h2>
            <p className="whitespace-pre-wrap">{r.raw_text}</p>
            <Form method="post" className="grid gap-3">
              <CsrfField token={d.csrf} />
              <input type="hidden" name="id" value={r.id} />
              <label>
                Public, de-identified text
                <textarea name="text" maxLength={2000} />
              </label>
              <label>
                <input name="deidentified" type="checkbox" value="yes" />I
                removed identifying details and checked this text.
              </label>
              <Button
                type="submit"
                name="decision"
                value="published"
                variant="primary"
              >
                Publish
              </Button>
              <Button
                type="submit"
                name="decision"
                value="rejected"
                variant="outline"
              >
                Reject
              </Button>
            </Form>
          </section>
        ))
      )}
      {a?.ok === false ? (
        <p role="alert">
          Decision could not be saved. Check the text and de-identification
          confirmation.
        </p>
      ) : null}
      {a?.ok ? <p role="status">Decision saved.</p> : null}
    </AdminShell>
  );
}
