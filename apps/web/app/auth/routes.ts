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
  route("org/:orgId", "auth/routes/org.tsx"),
  route("admin", "auth/routes/admin.tsx"),
];
