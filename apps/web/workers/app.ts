import { createRequestHandler } from "react-router";

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
} satisfies ExportedHandler<Env>;
