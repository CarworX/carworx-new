import { index, route, type RouteConfig } from "@react-router/dev/routes";

import { authRoutes } from "./auth/routes";

export default [
  index("routes/home.tsx"),
  route("healthz", "routes/healthz.ts"),
  // P2-2 server search (Claude 19). JSON only; no page yet (P2-3).
  route("api/search", "routes/api.search.ts"),
  // P2-3 public pages (Claude 20). Server-rendered; work without JavaScript.
  route("search", "routes/search.tsx"),
  route("search/map", "routes/search.map.ts"),
  route("c/:category", "routes/c.$category.tsx"),
  route("p/:publicId", "routes/p.$publicId.tsx"),
  route("fines", "routes/fines.tsx"),
  // P2-5 visitor forms (Claude 22). The enquiry form lives on /p/:publicId.
  route("demand", "routes/demand.tsx"),
  route("support", "routes/support.tsx"),
  // Review tool: guarded by routes/_dev.guard.ts (404 outside local/staging).
  route("_dev/components", "routes/_dev.components.tsx"),
  ...authRoutes,
  // Unmatched paths are a real 404; root.tsx's ErrorBoundary draws the
  // D-041 lens page.
] satisfies RouteConfig;
