import { index, route, type RouteConfig } from "@react-router/dev/routes";

import { authRoutes } from "./auth/routes";

export default [
  index("routes/home.tsx"),
  route("healthz", "routes/healthz.ts"),
  // Review tool: guarded by routes/_dev.guard.ts (404 outside local/staging).
  route("_dev/components", "routes/_dev.components.tsx"),
  ...authRoutes,
  // Unmatched paths are a real 404; root.tsx's ErrorBoundary draws the
  // D-041 lens page.
] satisfies RouteConfig;
