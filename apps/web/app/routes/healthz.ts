/**
 * GET /healthz: liveness check for CI, local dev and (later) staging probes.
 *
 * Returns a fixed body with no personal data, no request data and no
 * environment values, and is never cached.
 */
export const HEALTH_BODY = { status: "ok", service: "carworx-web" } as const;

export function loader() {
  return Response.json(HEALTH_BODY, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
