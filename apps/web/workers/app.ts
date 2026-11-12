import { createRequestHandler } from "react-router";

import { pgClient, runRetention } from "../app/server/retention/run";
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
    // Every request passes the T5 boundary: Origin and CSRF checks before the
    // app runs, cache, cookie, redirect and security headers after it.
    return withSecurityBoundary(request, env, (checked, security) =>
      requestHandler(checked, { cloudflare: { env, ctx }, security }),
    );
  },
  // R-2: the daily retention cron (wrangler.jsonc triggers). Logs counts
  // only; any failure throws, so the cron run is marked failed.
  async scheduled(_controller, env) {
    const binding = (env as { RETENTION_DB?: { connectionString?: unknown } })
      .RETENTION_DB;
    const counts = await runRetention(binding, pgClient);
    console.log(JSON.stringify({ event: "retention", counts }));
  },
} satisfies ExportedHandler<Env>;
