import { applyDiditWebhook } from "../server/identity/didit.server";

export const DIDIT_WEBHOOK_PATH = "/api/identity/didit";

export async function dispatchDiditWebhook(request: Request, env: unknown) {
  const exact = new URL(request.url).pathname === DIDIT_WEBHOOK_PATH;
  const status =
    exact && request.method === "POST"
      ? await applyDiditWebhook(env, request)
      : 404;
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
