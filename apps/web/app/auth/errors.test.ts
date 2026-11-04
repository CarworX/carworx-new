import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { classifyAuthError } from "./errors";
import { isTicked, parseEmail, parsePassword, parseTotpCode } from "./forms";

// FIXTURE errors (constructed here, not returned by a live Auth server). The
// live paths run in integration/ against local Supabase.
describe("classifyAuthError (fixtures)", () => {
  it("treats an SMTP send failure (5xx) as a recoverable email failure", () => {
    const error = new AuthApiError(
      "Error sending confirmation email",
      500,
      "unexpected_failure",
    );
    expect(classifyAuthError(error)).toBe("email_failed");
  });

  it("treats the per-address resend limit as an email failure", () => {
    const error = new AuthApiError("rate", 429, "over_email_send_rate_limit");
    expect(classifyAuthError(error)).toBe("email_failed");
  });

  it.each([
    ["otp_expired", "link_invalid"],
    ["flow_state_not_found", "link_invalid"],
    ["bad_code_verifier", "link_invalid"],
    ["invalid_credentials", "invalid_credentials"],
    ["email_not_confirmed", "email_not_confirmed"],
    ["weak_password", "weak_password"],
  ])("maps %s to %s", (code, state) => {
    expect(classifyAuthError(new AuthApiError("x", 400, code))).toBe(state);
  });

  it("does not trust unknown errors", () => {
    expect(classifyAuthError(new Error("boom"))).toBe("unexpected");
  });
});

describe("form parsing", () => {
  function form(entries: Record<string, string>): FormData {
    const data = new FormData();
    for (const [k, v] of Object.entries(entries)) data.set(k, v);
    return data;
  }

  it("treats consent as given only when the box was sent ticked", () => {
    expect(isTicked(form({}), "consent")).toBe(false);
    expect(isTicked(form({ consent: "" }), "consent")).toBe(false);
    expect(isTicked(form({ consent: "on" }), "consent")).toBe(true);
  });

  it("validates email, password and TOTP code", () => {
    expect(parseEmail(form({ email: " A@Example.Test " }))).toBe(
      "a@example.test",
    );
    expect(parseEmail(form({ email: "nope" }))).toBeNull();
    expect(parsePassword(form({ password: "short" }))).toBeNull();
    expect(parsePassword(form({ password: "long-enough-pass" }))).toBe(
      "long-enough-pass",
    );
    expect(parseTotpCode(form({ code: "123 456" }))).toBe("123456");
    expect(parseTotpCode(form({ code: "12345a" }))).toBeNull();
  });
});
