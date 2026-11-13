import { route, type RouteConfigEntry } from "@react-router/dev/routes";
export const paymentRoutes: RouteConfigEntry[] = [
  route("checkout/:holdId", "routes/checkout.$holdId.tsx"),
  route("payments/result", "routes/payments.result.tsx"),
  route("admin/money", "routes/admin.money.tsx"),
  route("admin/reviews", "routes/admin.reviews.tsx"),
  route("bookings/:id/review", "routes/bookings.$id.review.tsx"),
  route("reviews/:organisationId", "routes/reviews.$organisationId.tsx"),
];
