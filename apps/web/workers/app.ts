import {
  DIDIT_WEBHOOK_PATH,
  dispatchDiditWebhook,
} from "../app/routes/api.identity.didit";
import { FINES_CALLBACK_PATH } from "../app/server/fines/sandbox.server";
import { dispatchFinesCallback } from "../app/routes/api.fines.callback";
import { createRequestHandler } from "react-router";

import { mediaBucket } from "../app/server/media/cover.server";
import { finalEmailSender } from "../app/server/retention/final-email.server";
import {
  pgClient,
  purgeAccounts,
  purgeMedia,
  runRetention,
} from "../app/server/retention/run";
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
    const path = new URL(request.url).pathname;
    if (
      path === DIDIT_WEBHOOK_PATH ||
      path.startsWith(DIDIT_WEBHOOK_PATH + "/")
    ) {
      return dispatchDiditWebhook(request, env);
    }
    if (
      path === FINES_CALLBACK_PATH ||
      path.startsWith(FINES_CALLBACK_PATH + "/")
    ) {
      return dispatchFinesCallback(request, env);
    }
    if (path === MAIL_WEBHOOK_PATH) {
      return dispatchMailWebhook(request, env);
    }
    // Every request passes the T5 boundary: Origin and CSRF checks before the
    // app runs, cache, cookie, redirect and security headers after it.
    return withSecurityBoundary(request, env, (checked, security) =>
      requestHandler(checked, { cloudflare: { env, ctx }, security }),
    );
  },
  // Keep the minute mail drain separate from the daily retention job.
  async scheduled(controller, env) {
    if (controller.cron === "* * * * *") {
      await drainScheduledMail(env);
      return;
    }
    if (controller.cron !== "17 1 * * *")
      throw new Error("Unknown scheduled task");
    const binding = (env as { RETENTION_DB?: { connectionString?: unknown } })
      .RETENTION_DB;
    const counts = await runRetention(binding, pgClient);
    console.log(JSON.stringify({ event: "retention", counts }));
    // Cover photo files (D-098): counts only in the log.
    const media = await purgeMedia(binding, pgClient, mediaBucket(env));
    console.log(JSON.stringify({ event: "retention_media", ...media }));
    // Closed accounts past their 14 days (D-098): counts only in the log.
    const accounts = await purgeAccounts(
      binding,
      pgClient,
      await finalEmailSender(env),
    );
    console.log(JSON.stringify({ event: "retention_accounts", ...accounts }));
  },
} satisfies ExportedHandler<Env>;
