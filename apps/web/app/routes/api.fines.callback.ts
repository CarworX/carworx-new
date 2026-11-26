import {
  applySandboxCallback,
  FINES_CALLBACK_PATH,
} from "../server/fines/sandbox.server";

export async function dispatchFinesCallback(request: Request, env: unknown) {
  const exact = new URL(request.url).pathname === FINES_CALLBACK_PATH;
  const status =
    exact && request.method === "POST"
      ? await applySandboxCallback(request, env)
      : 404;
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
