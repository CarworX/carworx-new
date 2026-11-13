import { route, type RouteConfigEntry } from "@react-router/dev/routes";
export const paymentRoutes: RouteConfigEntry[] = [
  route("checkout/:holdId", "routes/checkout.$holdId.tsx"),
  route("payments/result", "routes/payments.result.tsx"),
];
