import { index, route, type RouteConfig } from "@react-router/dev/routes";

import { authRoutes } from "./auth/routes";

export default [
  index("routes/home.tsx"),
  route("healthz", "routes/healthz.ts"),
  // P2-2 server search (Claude 19). JSON only; no page yet (P2-3).
  route("api/search", "routes/api.search.ts"),
  route("api/location", "routes/api.location.ts"),
  // P2-3 public pages (Claude 20). Server-rendered; work without JavaScript.
  route("search", "routes/search.tsx"),
  route("search/location", "routes/search.location.tsx"),
  route("search/map", "routes/search.map.ts"),
  route("c/:category", "routes/c.$category.tsx"),
  route("p/:publicId", "routes/p.$publicId.tsx"),
  // Finish-build PR 3 (D-098): cover photos from the R2 bucket MEDIA.
  route("media/covers/:file", "routes/media.covers.$file.ts"),
  route("fines", "routes/fines.tsx"),
  route("fines/mine", "routes/fines.mine.tsx"),
  // P2-5 visitor forms (Claude 22). The enquiry form lives on /p/:publicId.
  route("demand", "routes/demand.tsx"),
  route("support", "routes/support.tsx"),
  // G-PROD E1 and E2: rendered from planning/legal/ (drafts until approved).
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  // Review tool: guarded by routes/_dev.guard.ts (404 outside local/staging).
  route("_dev/components", "routes/_dev.components.tsx"),
  ...authRoutes,
  // Unmatched paths are a real 404; root.tsx's ErrorBoundary draws the
  // D-041 lens page.
] satisfies RouteConfig;
