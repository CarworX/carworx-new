import { throwRedirect } from "../auth/http.server";
import { requireSignedIn } from "../auth/session.server";
import type { Route } from "./+types/provider.apply";

/** The one-shot form is retired; submissions need explicit O3 acknowledgements. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  return throwRedirect("/provider/get-listed/business", signedIn.headers);
}

/** Old bookmarked forms cannot bypass the acknowledged submission flow. */
export async function action({ request, context }: Route.ActionArgs) {
  const signedIn = await requireSignedIn(request, context.security);
  return throwRedirect("/provider/get-listed/business", signedIn.headers);
}

export default function Apply() {
  return null;
}
