import { redirect } from "react-router";

import { authRequest } from "../session.server";
import type { Route } from "./+types/sign-out";

/** GET does nothing (a link or prefetch must never sign anyone out). */
export function loader() {
  return redirect("/");
}

/**
 * POST /auth/sign-out: ends this session at the Auth server (so its tokens
 * stop working on the next request, even if a copy of the cookie survives)
 * and clears the session cookies.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const auth = authRequest(request, context.security);
  await auth.supabase.auth.signOut({ scope: "local" });
  return redirect("/", { headers: auth.headers });
}
