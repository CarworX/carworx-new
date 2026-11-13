import { route, type RouteConfigEntry } from "@react-router/dev/routes";

/** T3 sign-in routes and the personal pages they protect. Spread into app/routes.ts. */
export const authRoutes: RouteConfigEntry[] = [
  route("auth/sign-up", "auth/routes/sign-up.tsx"),
  route("auth/sign-in", "auth/routes/sign-in.tsx"),
  route("auth/callback", "auth/routes/callback.tsx"),
  route("auth/confirm", "auth/routes/confirm.tsx"),
  route("auth/check-email", "auth/routes/check-email.tsx"),
  route("auth/forgot-password", "auth/routes/forgot-password.tsx"),
  route("auth/reset-password", "auth/routes/reset-password.tsx"),
  route("auth/sign-out", "auth/routes/sign-out.tsx"),
  route("auth/mfa", "auth/routes/mfa.tsx"),
  route("account", "auth/routes/account.tsx"),
  route("account/:tab", "routes/account.$tab.tsx"),
  route("org/:orgId", "auth/routes/org.tsx"),
  route("admin", "auth/routes/admin.tsx"),
  // P2-4 (Claude 21): signed-in provider pages.
  route("provider", "routes/provider.tsx"),
  route("provider/apply", "routes/provider.apply.tsx"),
  route("provider/get-listed/:step", "routes/provider.get-listed.$step.tsx"),
  route("provider/setup/:task/:step", "routes/provider.setup.$task.$step.tsx"),
  // Claude 26: per-day opening hours after listing (owner/manager edit).
  route("provider/hours/:publicId", "routes/provider.hours.$publicId.tsx"),
  route("join/:token?", "routes/join.$token.tsx"),
  route("provider/claim/:publicId", "routes/provider.claim.$publicId.tsx"),
  // P2-7 (Claude 21): admin tools, listed admin at aal2 only.
  route("admin/listings", "routes/admin.listings.tsx"),
  route("admin/today", "routes/admin.today.tsx"),
  route("admin/listings/:publicId", "routes/admin.listings.$publicId.tsx"),
  route("admin/claims", "routes/admin.claims.tsx"),
  route("admin/claims/:id", "routes/admin.claims.$id.tsx"),
  route("admin/audit", "routes/admin.audit.tsx"),
  // P2-5 (Claude 22): private demand capture and support cases, aal2 only.
  route("admin/demand", "routes/admin.demand.tsx"),
  route("admin/support", "routes/admin.support.tsx"),
  route("admin/support/:id", "routes/admin.support.$id.tsx"),
];
