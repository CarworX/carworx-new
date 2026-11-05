import { isAuthError } from "@supabase/supabase-js";

/**
 * Maps Supabase Auth errors to the app's recoverable states. Messages are
 * fixed strings: no Supabase message, email address or token is echoed.
 */
export type AuthFailure =
  | "email_failed"
  | "email_not_confirmed"
  | "invalid_credentials"
  | "weak_password"
  | "rate_limited"
  | "link_invalid"
  | "same_password"
  | "unexpected";

export function classifyAuthError(error: unknown): AuthFailure {
  if (!isAuthError(error)) return "unexpected";
  switch (error.code) {
    case "over_email_send_rate_limit":
      return "email_failed";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "invalid_credentials":
      return "invalid_credentials";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "over_request_rate_limit":
      return "rate_limited";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
    case "bad_oauth_state":
      return "link_invalid";
    default:
      break;
  }
  // Auth answers 5xx when its SMTP send fails ("Error sending ... email").
  if (error.status !== undefined && error.status >= 500) return "email_failed";
  if (error.status === 429) return "rate_limited";
  return "unexpected";
}

export const FAILURE_MESSAGES: Record<AuthFailure, string> = {
  email_failed:
    "We couldn't send the email just now. Wait a minute, then try again. Nothing else has changed.",
  email_not_confirmed:
    "Confirm your email address first. We can send you a new link.",
  invalid_credentials: "That email and password don't match an account.",
  weak_password:
    "Choose a longer password: at least 12 characters, and not a common one.",
  rate_limited: "Too many attempts. Wait a few minutes, then try again.",
  link_invalid:
    "This link has expired or has already been used. You can ask for a new one.",
  same_password: "Choose a password you haven't used for this account.",
  unexpected: "Something went wrong. Try again in a moment.",
};

export function isEmailSendFailure(error: unknown): boolean {
  return classifyAuthError(error) === "email_failed";
}
