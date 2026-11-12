import { describe, expect, it } from "vitest";

import type { MailDatabase } from "./outbox.server";
import {
  dispatchMailWebhook,
  drainScheduledMail,
  MAIL_WEBHOOK_PATH,
} from "./runtime.server";

function fixture() {
  const seen: string[] = [];
  const db: MailDatabase = {
    enqueue: () => Promise.resolve("synthetic-job"),
    claim: () => {
      seen.push("claim");
      return Promise.resolve(null);
    },
    purge: () => {
      seen.push("purge");
      return Promise.resolve(0);
    },
    finish: () => Promise.resolve(true),
    delivery: () => {
      seen.push("delivery");
      return Promise.resolve(true);
    },
  };
  const env = {
    CARWORX_ENV: "staging",
    APP_ORIGIN: "https://staging.example.test",
    SUPABASE_URL: "https://supabase.example.test",
    SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-key",
    STAGING_APPROVED_RECIPIENTS_JSON: '["synthetic@example.test"]',
    MAIL_DB: { connectionString: "synthetic-private-connection" },
    MAIL_ENABLED: "1",
    MAIL_DOMAIN_VERIFIED: "1",
    MAIL_FROM: "hello@mail.example.test",
    MAIL_SENDING_DOMAIN: "mail.example.test",
    MAIL_ENCRYPTION_KEY: "AQ".repeat(21) + "A",
    RESEND_API_KEY: "re_synthetic_key_only",
    // The same public Svix vector used by mail.test.ts, never a live credential.
    RESEND_WEBHOOK_SECRET: ["whsec", "plJ3nmyCDGBKInavdOK15jsl"].join("_"),
  };
  return {
    env,
    db,
    seen,
    dependencies: { database: () => db, now: () => 1731705121_000 },
  };
}

describe("mail Worker integration", () => {
  it("does nothing outside staging or without a scoped database binding", async () => {
    const f = fixture();
    await drainScheduledMail(
      { ...f.env, CARWORX_ENV: "local" },
      f.dependencies,
    );
    await drainScheduledMail({ ...f.env, MAIL_DB: undefined }, f.dependencies);
    expect(f.seen).toEqual([]);
  });
  it("purges expired ciphertext while sending is disabled, without sending", async () => {
    const f = fixture();
    await drainScheduledMail({ ...f.env, MAIL_ENABLED: "0" }, f.dependencies);
    expect(f.seen).toEqual(["purge"]);
  });
  it("purges then drains only one job when fully configured", async () => {
    const f = fixture();
    await drainScheduledMail(f.env, f.dependencies);
    expect(f.seen).toEqual(["purge", "claim"]);
  });
  it("accepts a signed provider request without browser CSRF on the exact webhook path", async () => {
    const f = fixture();
    const request = new Request(f.env.APP_ORIGIN + MAIL_WEBHOOK_PATH, {
      method: "POST",
      headers: {
        "svix-id": "msg_loFOjxBNrRLzqYUf",
        "svix-timestamp": "1731705121",
        "svix-signature": "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=",
      },
      body: '{"event_type":"ping","data":{"success":true}}',
    });
    const response = await dispatchMailWebhook(request, f.env, f.dependencies);
    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("refuses another path, GET and unsigned POST", async () => {
    const f = fixture();
    expect(
      (
        await dispatchMailWebhook(
          new Request(f.env.APP_ORIGIN + "/support", { method: "POST" }),
          f.env,
          f.dependencies,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await dispatchMailWebhook(
          new Request(f.env.APP_ORIGIN + MAIL_WEBHOOK_PATH),
          f.env,
          f.dependencies,
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await dispatchMailWebhook(
          new Request(f.env.APP_ORIGIN + MAIL_WEBHOOK_PATH, {
            method: "POST",
            body: "{}",
          }),
          f.env,
          f.dependencies,
        )
      ).status,
    ).toBe(400);
    expect(f.seen).toEqual([]);
  });
});
