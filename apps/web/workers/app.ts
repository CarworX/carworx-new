import { createRequestHandler } from "react-router";

import { pgClient, runRetention } from "../app/server/retention/run";
import {
  MAIL_WEBHOOK_PATH,
  dispatchMailWebhook,
  drainScheduledMail,
} from "../app/server/mail/runtime.server";

import {
  withSecurityBoundary,
  type SecurityContext,
} from "../app/server/security/boundary";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    /** Set by the T5 security boundary for every request. */
    security: SecurityContext;
  }
}

// P2-2 search limiter (SQLite Durable Object, D-081).
export { SearchLimiter } from "../app/server/search/limiter";

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    // This exact endpoint uses raw-body Svix authentication instead of a browser
    // CSRF token. All other requests retain the full T5 security boundary.
    if (new URL(request.url).pathname === MAIL_WEBHOOK_PATH) {
      return dispatchMailWebhook(request, env);
    }
    // Every request passes the T5 boundary: Origin and CSRF checks before the
    // app runs, cache, cookie, redirect and security headers after it.
    return withSecurityBoundary(request, env, (checked, security) =>
      requestHandler(checked, { cloudflare: { env, ctx }, security }),
    );
  },
  // Cron (wrangler.jsonc triggers): R-2 retention, plus draining queued
  // mail (O5). Retention logs counts only; any failure throws, so the run is
  // marked failed.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(drainScheduledMail(env));
    const binding = (env as { RETENTION_DB?: { connectionString?: unknown } })
      .RETENTION_DB;
    const counts = await runRetention(binding, pgClient);
    console.log(JSON.stringify({ event: "retention", counts }));
  },
} satisfies ExportedHandler<Env>;
