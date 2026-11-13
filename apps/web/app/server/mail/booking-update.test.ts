import { describe, expect, it, vi } from "vitest";
import {
  createMailService,
  type ClaimedMail,
  type MailConfig,
  type MailDatabase,
} from "./outbox.server";

const now = Date.parse("2026-11-13T12:00:00Z");
const config: MailConfig = {
  origin: "https://staging.example.test",
  from: "hello@mail.example.test",
  apiKey: "re_synthetic_key_only",
  encryptionKey: "AQ".repeat(21) + "A",
  approvedRecipients: new Set(["synthetic@example.test"]),
  dailyLimit: 100,
};
function fixture() {
  let job: ClaimedMail | null = null;
  const finish = vi.fn<MailDatabase["finish"]>().mockResolvedValue(true);
  const current = vi.fn().mockResolvedValue(true);
  const db: MailDatabase = {
    enqueue: (logical_key, template, _hash, encrypted_payload, expires_at) => {
      job = {
        id: "ad000000-0000-4000-8000-000000000001",
        logical_key,
        template: template as ClaimedMail["template"],
        encrypted_payload,
        expires_at,
        lease_token: "ad000000-0000-4000-8000-000000000002",
        attempts: 1,
      };
      return Promise.resolve(job.id);
    },
    claim: () => Promise.resolve(job),
    finish,
    purge: () => Promise.resolve(0),
    delivery: () => Promise.resolve(true),
    current,
  };
  return { db, finish, current };
}
const update = {
  kind: "booking_update" as const,
  to: "synthetic@example.test",
  bookingId: "ad000000-0000-4000-8000-000000000003",
  expiresAt: new Date(now + 3600000).toISOString(),
};

describe("A32 booking event mail", () => {
  it("retries an accepted-but-timed-out send with the same key and encrypted original", async () => {
    const { db, finish } = fixture();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("synthetic timeout after acceptance"))
      .mockResolvedValueOnce(
        Response.json({ id: "ad000000-0000-4000-8000-000000000004" }),
      );
    const service = createMailService(config, db, fetcher, () => now);
    expect(await service.enqueue("booking/123/customer", update)).toBe(
      "queued",
    );
    expect(await service.drainOne()).toBe("retry");
    expect(await service.drainOne()).toBe("sent");
    expect(
      fetcher.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get("Idempotency-Key"),
      ),
    ).toEqual(["carworx/booking/123/customer", "carworx/booking/123/customer"]);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(
      fetcher.mock.calls[1]?.[1]?.body,
    );
    expect(finish.mock.calls.map((c) => c[2])).toEqual(["retry", "sent"]);
  });
  it("suppresses stale state or revoked recipients at send time", async () => {
    const { db, finish, current } = fixture();
    current.mockResolvedValue(false);
    const fetcher = vi.fn<typeof fetch>();
    const service = createMailService(config, db, fetcher, () => now);
    await service.enqueue("booking/123/customer", update);
    expect(await service.drainOne()).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      "failed",
      undefined,
    );
  });
  it("retries a freshness-check outage without sending", async () => {
    const { db, current } = fixture();
    current.mockRejectedValue(new Error("synthetic outage"));
    const fetcher = vi.fn<typeof fetch>();
    const service = createMailService(config, db, fetcher, () => now);
    await service.enqueue("booking/123/customer", update);
    expect(await service.drainOne()).toBe("retry");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not send an expired booking action even if the database returns it", async () => {
    const { db } = fixture();
    const fetcher = vi.fn<typeof fetch>();
    let clock = now;
    const service = createMailService(config, db, fetcher, () => clock);
    await service.enqueue("booking/123/customer", update);
    clock += 86400001;
    expect(await service.drainOne()).toBe("failed");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
