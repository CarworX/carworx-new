import { beforeEach, describe, expect, it, vi } from "vitest";

// Synthetic values only. The mail database is replaced, so nothing connects.
type Enqueue = (
  key: string,
  template: string,
  recipientHash: string,
  envelope: string,
  expiresAt: string,
) => Promise<string>;
const enqueue = vi.fn<Enqueue>();
vi.mock("../server/mail/db.server", () => ({
  createMailDatabase: () => ({ enqueue }),
}));

import {
  inviteMailConfigured,
  inviteMailSender,
  type InviteMailSender,
} from "./invite-mail.server";

async function senderFor(
  env: unknown,
  now = () => NOW,
): Promise<InviteMailSender> {
  const send = await inviteMailSender(env, now);
  if (send === null) throw new Error("Mail should be configured here");
  return send;
}
function call(index: number) {
  const args = enqueue.mock.calls[index];
  if (args === undefined) throw new Error("No mail was queued");
  const [key, template, recipientHash, envelope, expiresAt] = args;
  return { key, template, recipientHash, envelope, expiresAt };
}

const NOW = Date.parse("2026-11-25T14:00:00.000Z");
const TOKEN = "Zk3-_".repeat(8) + "Abc"; // 43 chars of base64url
const STAGING = {
  APP_ORIGIN: "https://staging.carworx.example.test",
  SUPABASE_URL: "https://synthetic-ref.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_000000000000",
  CARWORX_ENV: "staging",
  STAGING_APPROVED_RECIPIENTS_JSON: JSON.stringify(["approved@example.test"]),
  MAIL_ENABLED: "1",
  MAIL_ENCRYPTION_KEY: "AQ".repeat(21) + "A",
  MAIL_DB: { connectionString: "postgres://synthetic" },
};

describe("invite email (PR 8)", () => {
  beforeEach(() => {
    enqueue.mockReset().mockResolvedValue("job");
  });

  it("is off unless mail is fully configured", async () => {
    expect(TOKEN).toHaveLength(43);
    expect(inviteMailConfigured(STAGING)).toBe(true);
    for (const missing of [
      "MAIL_ENABLED",
      "MAIL_ENCRYPTION_KEY",
      "MAIL_DB",
      "STAGING_APPROVED_RECIPIENTS_JSON",
    ]) {
      const env = { ...STAGING, [missing]: undefined };
      expect(inviteMailConfigured(env)).toBe(false);
      expect(await inviteMailSender(env)).toBeNull();
    }
    expect(inviteMailConfigured({ ...STAGING, MAIL_ENABLED: "0" })).toBe(false);
    expect(inviteMailConfigured(undefined)).toBe(false);
    // Production mail stays off until it has its own launch evidence.
    expect(
      inviteMailConfigured({
        ...STAGING,
        CARWORX_ENV: "production",
        STAGING_APPROVED_RECIPIENTS_JSON: undefined,
      }),
    ).toBe(false);
  });

  it("queues one invite for an approved address, keyed by a hash, not the token", async () => {
    const send = await senderFor(STAGING);
    expect(await send(TOKEN, "approved@example.test")).toBe("queued");
    expect(enqueue).toHaveBeenCalledTimes(1);
    const { key, template, recipientHash, envelope, expiresAt } = call(0);
    expect(template).toBe("invite");
    expect(key).toMatch(/^invite\/[0-9a-f]{64}$/);
    expect(key).not.toContain(TOKEN);
    expect(recipientHash).toMatch(/^[0-9a-f]{64}$/);
    expect(envelope).not.toContain(TOKEN);
    expect(envelope).not.toContain("approved@example.test");
    // Never longer than the invite itself (seven days).
    expect(Date.parse(expiresAt) - NOW).toBeLessThan(7 * 86_400_000);
    expect(Date.parse(expiresAt) - NOW).toBeGreaterThan(6 * 86_400_000);
  });

  it("keeps the recipient restriction: an address off the list is never queued", async () => {
    const send = await senderFor(STAGING);
    expect(await send(TOKEN, "stranger@example.test")).toBe("not_sent");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("is case-insensitive about the approved address", async () => {
    const send = await senderFor(STAGING);
    expect(await send(TOKEN, "Approved@Example.Test")).toBe("queued");
  });

  it("reports a database outage without throwing", async () => {
    enqueue.mockImplementation(() =>
      Promise.reject(new Error("mail_database_unavailable")),
    );
    const send = await senderFor(STAGING);
    expect(await send(TOKEN, "approved@example.test")).toBe("unavailable");
  });

  it("gives the same invite the same key, so a retry cannot double-send", async () => {
    const send = await senderFor(STAGING);
    await send(TOKEN, "approved@example.test");
    await send(TOKEN, "approved@example.test");
    expect(call(0).key).toBe(call(1).key);
  });
});
