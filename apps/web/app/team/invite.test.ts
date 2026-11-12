import { describe, expect, it } from "vitest";
import {
  clearInviteCookie,
  INVITE_COOKIE,
  inviteCookie,
  pendingInvite,
} from "./invite.server";
import { isCompliantSetCookie } from "../server/security/cookies";

describe("invite transport", () => {
  const token = "x".repeat(43);
  it("keeps the secret in a secure HttpOnly cookie for ten minutes", () => {
    const cookie = inviteCookie(token);
    expect(isCompliantSetCookie(cookie)).toBe(true);
    expect(cookie).toContain("Max-Age=600");
    const request = new Request("https://app.example.test/join", {
      headers: { Cookie: `${INVITE_COOKIE}=${token}` },
    });
    expect(pendingInvite(request)).toBe(token);
    expect(request.url).not.toContain(token);
  });
  it("rejects malformed tokens, absent cookies and clears consumed invites", () => {
    expect(() => inviteCookie("short")).toThrow();
    expect(
      pendingInvite(new Request("https://app.example.test/join")),
    ).toBeNull();
    expect(
      pendingInvite(
        new Request("https://app.example.test/join", {
          headers: { Cookie: `${INVITE_COOKIE}=bad` },
        }),
      ),
    ).toBeNull();
    expect(clearInviteCookie()).toContain("Max-Age=0");
    expect(isCompliantSetCookie(clearInviteCookie())).toBe(true);
  });
});
