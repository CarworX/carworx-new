import {
  discoverLocations,
  privateLocationHeaders,
} from "../server/geo/discovery.server";
import type { Route } from "./+types/api.location";

export function loader({ context }: Route.LoaderArgs) {
  return Response.json(
    { csrf: context.security.csrfToken },
    { headers: privateLocationHeaders },
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const { candidates, status, headers } = await discoverLocations(
    request,
    context.cloudflare.env,
    true,
  );
  return Response.json({ candidates }, { status, headers });
}
