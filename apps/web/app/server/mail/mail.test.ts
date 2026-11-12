import { describe, expect, it } from "vitest";

import {
  createMailService,
  readMailConfig,
  type ClaimedMail,
  type MailConfig,
  type MailDatabase,
  type MailMessage,
} from "./outbox.server";
import { receiveMailWebhook } from "./webhook.server";

const NOW = Date.parse("2026-11-12T18:00:00.000Z");
const TOKEN = "A".repeat(43);
const PROVIDER = "d9500000-0000-4000-8000-000000000001";
const config: MailConfig = {
  origin: "https://staging.carworx.example.test",
  from: "hello@mail.example.test",
  apiKey: "re_synthetic_key_only",
  encryptionKey: "AQ".repeat(21) + "A",
  approvedRecipients: new Set(["synthetic@example.test"]),
  dailyLimit: 100,
};
const invite: MailMessage = {
  kind: "invite",
  to: "synthetic@example.test",
  token: TOKEN,
  expiresAt: new Date(NOW + 86400_000).toISOString(),
};

function database() {
  let job: ClaimedMail | null = null;
  const results: { result: string; providerId?: string }[] = [];
  let recipientHash = "";
  const db: MailDatabase = {
    enqueue(key, template, hash, encrypted_payload, expires_at) {
      recipientHash = hash;
      job = {
        id: "d9400000-0000-4000-8000-000000000001",
        logical_key: key,
        template: template as MailMessage["kind"],
        encrypted_payload,
        expires_at,
        lease_token: "d9600000-0000-4000-8000-000000000001",
        attempts: 1,
      };
      return Promise.resolve(job.id);
    },
    claim: () => Promise.resolve(job),
    purge: () => Promise.resolve(0),
    finish(_id, _lease, result, providerId) {
      results.push({ result, providerId });
      if (result !== "retry") job = null;
      return Promise.resolve(true);
    },
    delivery: () => Promise.resolve(true),
  };
  return { db, results, job: () => job, recipientHash: () => recipientHash };
}

describe("transactional email", () => {
  it("requires verified-domain acknowledgement, enabled staging and exact approved recipients", () => {
    const security = {
      appOrigin: config.origin,
      supabaseUrl: "https://supabase.example.test",
      supabasePublishableKey: "synthetic-publishable-key",
      environment: "staging" as const,
      approvedRecipients: config.approvedRecipients,
    };
    const env = {
      MAIL_ENABLED: "1",
      MAIL_DOMAIN_VERIFIED: "1",
      MAIL_FROM: config.from,
      MAIL_SENDING_DOMAIN: "mail.example.test",
      MAIL_ENCRYPTION_KEY: config.encryptionKey,
      RESEND_API_KEY: config.apiKey,
    };
    expect(readMailConfig(env, security)?.dailyLimit).toBe(100);
    expect(
      readMailConfig({ ...env, MAIL_DOMAIN_VERIFIED: "0" }, security),
    ).toBeNull();
    expect(
      readMailConfig({ ...env, MAIL_DAILY_LIMIT: "101" }, security),
    ).toBeNull();
    expect(
      readMailConfig(env, { ...security, approvedRecipients: null }),
    ).toBeNull();
    expect(readMailConfig(env, { ...security, environment: null })).toBeNull();
  });

  it("stores an authenticated ciphertext and recipient hash, never the invite or address", async () => {
    const state = database();
    const service = createMailService(config, state.db, fetch, () => NOW);
    expect(await service.enqueue("invite/synthetic-1", invite)).toBe("queued");
    const envelope = state.job()?.encrypted_payload ?? "";
    expect(envelope).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
    expect(envelope).not.toContain(TOKEN);
    expect(envelope).not.toContain(invite.to);
    expect(state.recipientHash()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuses unapproved recipients, unsafe keys, malformed tokens and expired codes", async () => {
    const state = database();
    const service = createMailService(config, state.db, fetch, () => NOW);
    expect(
      await service.enqueue("invite/1", {
        ...invite,
        to: "other@example.test",
      }),
    ).toBe("invalid");
    expect(await service.enqueue("email@example.test", invite)).toBe("invalid");
    expect(
      await service.enqueue("invite/1", {
        ...invite,
        token: "https://attacker.example/",
      }),
    ).toBe("invalid");
    expect(
      await service.enqueue("code/1", {
        kind: "security_code",
        to: invite.to,
        code: "123456",
        expiresAt: new Date(NOW).toISOString(),
      }),
    ).toBe("invalid");
    expect(state.job()).toBeNull();
  });

  it("retries ambiguous sends with the same idempotency key and byte-identical body", async () => {
    const state = database();
    const requests: RequestInit[] = [];
    const send: typeof fetch = (_input, init) => {
      requests.push(init ?? {});
      if (requests.length === 1)
        return Promise.reject(new Error("synthetic transport failure"));
      return Promise.resolve(
        new Response(JSON.stringify({ id: PROVIDER }), { status: 200 }),
      );
    };
    const service = createMailService(config, state.db, send, () => NOW);
    await service.enqueue("invite/1", invite);
    expect(await service.drainOne()).toBe("retry");
    expect(await service.drainOne()).toBe("sent");
    expect(requests[0]?.body).toBe(requests[1]?.body);
    expect(new Headers(requests[0]?.headers).get("Idempotency-Key")).toBe(
      "carworx/invite/1",
    );
    expect(state.results).toEqual([
      { result: "retry", providerId: undefined },
      { result: "sent", providerId: PROVIDER },
    ]);
  });

  it("does not send a tampered or swapped encrypted envelope", async () => {
    const state = database();
    let sent = false;
    const send: typeof fetch = () => {
      sent = true;
      return Promise.resolve(new Response());
    };
    const service = createMailService(config, state.db, send, () => NOW);
    await service.enqueue("invite/1", invite);
    const job = state.job();
    if (job === null) throw new Error("missing synthetic fixture");
    job.logical_key = "invite/another";
    expect(await service.drainOne()).toBe("failed");
    expect(sent).toBe(false);
  });

  it("expires security codes before delivery and never extends their lifetime", async () => {
    const state = database();
    let clock = NOW;
    let calls = 0;
    const send: typeof fetch = () => {
      calls++;
      return Promise.resolve(new Response());
    };
    const service = createMailService(config, state.db, send, () => clock);
    expect(
      await service.enqueue("code/1", {
        kind: "security_code",
        to: invite.to,
        code: "123456",
        expiresAt: new Date(NOW + 600_000).toISOString(),
      }),
    ).toBe("queued");
    expect(state.job()?.encrypted_payload).not.toContain("123456");
    clock += 600_001;
    expect(await service.drainOne()).toBe("failed");
    expect(calls).toBe(0);
  });

  for (const [status, expected] of [
    [429, "retry"],
    [409, "retry"],
    [503, "retry"],
    [422, "failed"],
  ] as const) {
    it(`handles provider ${String(status)} without exposing its body`, async () => {
      const state = database();
      const send: typeof fetch = () =>
        Promise.resolve(
          new Response("synthetic private provider error", { status }),
        );
      const service = createMailService(config, state.db, send, () => NOW);
      await service.enqueue("invite/1", invite);
      expect(await service.drainOne()).toBe(expected);
    });
  }
});

describe("Resend webhook verification", () => {
  // Fixed synthetic HMAC fixture; expected bytes are checked independently of WebCrypto.
  const raw = '{"event_type":"ping","data":{"success":true}}';
  const headers = {
    "svix-id": "msg_loFOjxBNrRLzqYUf",
    "svix-timestamp": "1731705121",
    "svix-signature": "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=",
  };
  const secret = ["whsec", "plJ3nmyCDGBKInavdOK15jsl"].join("_");
  const time = 1731705121_000;
  const request = (body = raw) =>
    new Request("https://staging.example.test/api/mail/webhook", {
      method: "POST",
      headers,
      body,
    });
  it("accepts the fixed raw-body HMAC fixture", async () => {
    expect(
      await receiveMailWebhook(request(), secret, database().db, time),
    ).toBe("accepted");
  });
  it("rejects tampering, stale replay and an oversized body", async () => {
    expect(
      await receiveMailWebhook(request(raw + " "), secret, database().db, time),
    ).toBe("invalid");
    expect(
      await receiveMailWebhook(
        request(),
        secret,
        database().db,
        time + 300_001,
      ),
    ).toBe("invalid");
    expect(
      await receiveMailWebhook(
        request("A".repeat(65_537)),
        secret,
        database().db,
        time,
      ),
    ).toBe("invalid");
  });
});
