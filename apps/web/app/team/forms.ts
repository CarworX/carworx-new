import { field, isTicked } from "../auth/forms";

export type TeamRole = "owner" | "manager" | "staff";
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{43}$/;
export const DAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "7", label: "Sun" },
] as const;

export function inviteRole(value: string, actor: TeamRole) {
  return value === "staff" && actor !== "staff"
    ? "staff"
    : value === "manager" && actor === "owner"
      ? "manager"
      : null;
}

export function assignment(form: FormData) {
  const mode = field(form, "assignMode");
  if (mode !== "customer" && mode !== "business") return null;
  return {
    assign_mode: mode,
    offer_anyone: mode === "customer" && isTicked(form, "offerAnyone"),
  };
}

export function visibility(form: FormData) {
  const value = field(form, "visibility");
  return value === "phone" || value === "first_name" || value === "booking_only"
    ? { staff_contact_visibility: value }
    : null;
}

export function staffProfile(
  form: FormData,
  assignMode: "business" | "customer",
  allowedServices: readonly string[],
) {
  const services = form.getAll("services");
  const days = form.getAll("days");
  const firstName = field(form, "firstName").trim();
  if (
    services.length > 16 ||
    services.some(
      (v) => typeof v !== "string" || !allowedServices.includes(v),
    ) ||
    days.length > 7 ||
    days.some((v) => typeof v !== "string" || !/^[1-7]$/.test(v)) ||
    (assignMode === "customer" &&
      (firstName.length < 1 ||
        firstName.length > 60 ||
        /[\p{Cc}\p{Cf}]/u.test(firstName)))
  )
    return null;
  return {
    first_name: assignMode === "customer" ? firstName : null,
    service_slugs: [...new Set(services as string[])],
    days: [...new Set(days.map(Number))].sort((a, b) => a - b),
  };
}

export type TeamProblem =
  | "invalid_input"
  | "not_allowed"
  | "invite_limit"
  | "invite_invalid"
  | "already_member"
  | "unavailable";

export const TEAM_PROBLEMS: Record<TeamProblem, string> = {
  invalid_input: "Check your choices and try again.",
  not_allowed: "Your current access does not allow that change.",
  invite_limit:
    "There are already 50 pending invites. Wait for some to expire or be accepted.",
  invite_invalid:
    "This invite cannot be used. It may have expired, been used, or belong to another email address. Ask the business for a new invite.",
  already_member:
    "You already belong to this business. Open your business home.",
  unavailable: "This is temporarily unavailable. Please try again.",
};

export function teamProblem(error: {
  code?: string;
  message?: string;
}): TeamProblem {
  if (error.message === "invite_limit") return "invite_limit";
  if (error.message === "already_member") return "already_member";
  if (error.message === "invite_invalid") return "invite_invalid";
  if (error.code === "42501") return "not_allowed";
  if (error.code === "22023") return "invalid_input";
  return "unavailable";
}

export function setupHref(org: string, task: string, step = "start") {
  return `/provider/setup/${task}/${step}?org=${encodeURIComponent(org)}`;
}
