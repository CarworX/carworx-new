import { describe, expect, it } from "vitest";

import {
  Browser,
  confirmLink,
  createConfirmedUser,
  mailTo,
  PASSWORD,
  signIn,
  syntheticEmail,
} from "./harness";

// T3 (issue #7) email and password, through the real routes and local
// Supabase Auth. Emails are read from the local Mailpit sink.

async function signUp(browser: Browser, email: string, consent = true) {
  await browser.send("/auth/sign-up");
  return browser.send("/auth/sign-up", {
    form: { email, password: PASSWORD, ...(consent ? { consent: "on" } : {}) },
  });
}

describe("sign-up and confirmation", () => {
  it("renders the consent box unticked (POPIA, C5 G8)", async () => {
    const page = await new Browser().send("/auth/sign-up");
    expect(page.status).toBe(200);
    const box = /<input[^>]*name="consent"[^>]*>/.exec(page.body)?.[0] ?? "";
    expect(box).toContain('type="checkbox"');
    expect(box).not.toMatch(/\bchecked\b/);
  });

  it("refuses sign-up without consent and sends no email", async () => {
    const email = syntheticEmail("noconsent");
    const reply = await signUp(new Browser(), email, false);
    expect(reply.status).toBe(400);
    expect(reply.body).toContain('data-problem="consent_required"');
    await expect(mailTo(email, 1, 1500)).rejects.toThrow();
  });

  it("signs up, refuses sign-in until confirmed, confirms by POST, then signs in and out", async () => {
    const email = syntheticEmail("signup");
    const browser = new Browser();
    const created = await signUp(browser, email);
    expect(created.status).toBe(302);
    expect(created.location).toBe("/auth/check-email?sent=signup");
    expect(browser.sessionCookieNames()).toEqual([]);

    // Not confirmed yet: a recoverable state with a way to get a new link.
    const early = new Browser();
    await early.send("/auth/sign-in");
    const refused = await early.send("/auth/sign-in", {
      form: { intent: "password", email, password: PASSWORD },
    });
    expect(refused.status).toBe(400);
    expect(refused.body).toContain('data-problem="email_not_confirmed"');
    expect(refused.body).toContain("/auth/check-email?resend=signup");

    const [mail = ""] = await mailTo(email);
    const link = confirmLink(mail);
    expect(link).toMatch(/^\/auth\/confirm\?token_hash=[^&]+&type=email$/);

    // Opening the link (or a scanner prefetching it) spends nothing.
    const other = new Browser(); // a different browser from the one that signed up
    expect((await other.send(link)).status).toBe(200);
    const page = await other.send(link);
    expect(page.status).toBe(200);
    expect(page.body).toContain("Confirm my email");
    const url = new URL(link, "http://localhost:5173");
    const confirmed = await other.send("/auth/confirm", {
      form: {
        token_hash: url.searchParams.get("token_hash") ?? "",
        type: "email",
      },
    });
    expect(confirmed.status).toBe(302);
    expect(confirmed.location).toBe("/account?confirmed=1");
    const account = await other.send("/account?confirmed=1");
    expect(account.status).toBe(200);
    expect(account.body).toContain(email);

    const out = await other.send("/auth/sign-out", { form: {} });
    expect(out.location).toBe("/");
    expect((await other.send("/account")).status).toBe(302);

    const again = await signIn(email);
    expect((await again.send("/account")).status).toBe(200);
  });

  it("shows a recoverable state for an invalid or already-used link", async () => {
    const browser = new Browser();
    await browser.send(
      "/auth/confirm?token_hash=not-a-real-token-hash&type=email",
    );
    const bad = await browser.send("/auth/confirm", {
      form: { token_hash: "not-a-real-token-hash", type: "email" },
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toContain('data-problem="link_invalid"');
    expect(bad.body).toContain("/auth/check-email?resend=signup");

    const malformed = await browser.send(
      "/auth/confirm?type=email&token_hash=%3Cscript%3E",
    );
    expect(malformed.status).toBe(200);
    expect(malformed.body).toContain('data-problem="link_invalid"');

    const email = syntheticEmail("reuse");
    await signUp(new Browser(), email);
    const hash =
      new URL(
        confirmLink((await mailTo(email))[0] ?? ""),
        "http://localhost:5173",
      ).searchParams.get("token_hash") ?? "";
    const first = new Browser();
    await first.send("/auth/sign-in");
    expect(
      (
        await first.send("/auth/confirm", {
          form: { token_hash: hash, type: "email" },
        })
      ).status,
    ).toBe(302);
    const second = new Browser();
    await second.send("/auth/sign-in");
    const reused = await second.send("/auth/confirm", {
      form: { token_hash: hash, type: "email" },
    });
    expect(reused.status).toBe(400);
    expect(reused.body).toContain('data-problem="link_invalid"');
  });

  it("shows a recoverable state when Auth won't send the email (local max_frequency refusal)", async () => {
    // Labelled: the delivery failure here is Supabase Auth refusing a repeat
    // send inside max_frequency (429 over_email_send_rate_limit). An SMTP
    // outage (5xx) maps to the same state; that mapping is a unit fixture.
    const email = syntheticEmail("emailfail");
    const browser = new Browser();
    await signUp(browser, email);
    await browser.send("/auth/check-email?sent=signup");
    const resend = await browser.send("/auth/check-email", { form: { email } });
    expect(resend.status).toBe(503);
    expect(resend.body).toContain('data-problem="email_failed"');
    // Still recoverable: the resend form is right there.
    expect(resend.body).toContain("Send a new link");
  });

  it("answers the same for an address with no account", async () => {
    const browser = new Browser();
    await browser.send("/auth/check-email");
    const reply = await browser.send("/auth/check-email", {
      form: { email: syntheticEmail("nobody") },
    });
    expect(reply.status).toBe(200);
    expect(reply.body).toContain('data-outcome="sent"');
  });
});

describe("sign-in failures", () => {
  it("gives one message for a wrong password and an unknown address", async () => {
    const user = await createConfirmedUser("wrongpw");
    for (const [email, password] of [
      [user.email, "not-the-right-password"],
      [syntheticEmail("unknown"), PASSWORD],
    ] as const) {
      const browser = new Browser();
      await browser.send("/auth/sign-in");
      const reply = await browser.send("/auth/sign-in", {
        form: { intent: "password", email, password },
      });
      expect(reply.status).toBe(400);
      expect(reply.body).toContain('data-problem="invalid_credentials"');
      expect(browser.sessionCookieNames()).toEqual([]);
    }
  });
});

describe("password reset", () => {
  it("resets through the emailed link and only the new password works", async () => {
    const user = await createConfirmedUser("reset");
    const browser = new Browser();
    await browser.send("/auth/forgot-password");
    const asked = await browser.send("/auth/forgot-password", {
      form: { email: user.email },
    });
    expect(asked.status).toBe(200);
    expect(asked.body).toContain('data-outcome="sent"');

    const link = confirmLink((await mailTo(user.email))[0] ?? "");
    expect(link).toMatch(/type=recovery$/);
    const hash =
      new URL(link, "http://localhost:5173").searchParams.get("token_hash") ??
      "";
    const reset = new Browser();
    expect((await reset.send(link)).body).toContain(
      "Continue to a new password",
    );
    const verified = await reset.send("/auth/confirm", {
      form: { token_hash: hash, type: "recovery" },
    });
    expect(verified.location).toBe("/auth/reset-password");

    const form = await reset.send("/auth/reset-password");
    expect(form.status).toBe(200);
    const mismatch = await reset.send("/auth/reset-password", {
      form: {
        password: "a-brand-new-passphrase",
        confirm: "something-else-entirely",
      },
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body).toContain('data-problem="mismatch"');
    const saved = await reset.send("/auth/reset-password", {
      form: {
        password: "a-brand-new-passphrase",
        confirm: "a-brand-new-passphrase",
      },
    });
    expect(saved.status).toBe(302);
    expect(saved.location).toBe("/account?password=updated");

    const old = new Browser();
    await old.send("/auth/sign-in");
    const refused = await old.send("/auth/sign-in", {
      form: { intent: "password", email: user.email, password: PASSWORD },
    });
    expect(refused.status).toBe(400);
    await signIn(user.email, "a-brand-new-passphrase");
  });

  it("answers the same for an unknown address", async () => {
    const browser = new Browser();
    await browser.send("/auth/forgot-password");
    const reply = await browser.send("/auth/forgot-password", {
      form: { email: syntheticEmail("ghost") },
    });
    expect(reply.status).toBe(200);
    expect(reply.body).toContain('data-outcome="sent"');
  });

  it("shows a recoverable state on the reset page without a recovery session", async () => {
    const browser = new Browser();
    const page = await browser.send("/auth/reset-password");
    expect(page.status).toBe(200);
    expect(page.body).toContain('data-problem="link_invalid"');
    expect(page.body).toContain("/auth/forgot-password");
    const post = await browser.send("/auth/reset-password", {
      form: {
        password: "a-brand-new-passphrase",
        confirm: "a-brand-new-passphrase",
      },
    });
    expect(post.status).toBe(401);
  });
});
