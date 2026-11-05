import { data, redirect } from "react-router";

/*
 * React Router stops a loader early when it throws a Response (redirect or
 * error status). The lint rule wants Error objects, so the idiom lives here
 * only, with the rule disabled per line.
 */

export function throwRedirect(url: string, headers?: Headers): never {
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw redirect(url, { headers });
}

export function throwStatus(status: 404 | 500 | 503, headers?: Headers): never {
  const body =
    status === 404
      ? "Not found"
      : status === 503
        ? "Unavailable"
        : "Internal error";
  // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router control flow
  throw data(body, { status, headers });
}
