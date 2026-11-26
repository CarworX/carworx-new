import { describe, expect, it, vi } from "vitest";

import { makeDiditEraser, purgeDiditSessions } from "./didit-erasure.server";

const id = "00000000-0000-4000-8000-000000000001";
const providerSession = "00000000-0000-4000-8000-000000000002";
const claim_id = "00000000-0000-4000-8000-000000000003";
const env = { DIDIT_API_KEY: "synthetic" };

describe("Didit privacy erasure", () => {
  it("requests erasure without biometric retention and checks the response", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        session_id: providerSession,
        face_retention_outcome: "deleted",
      }),
    );
    await expect(
      makeDiditEraser(env, send)?.(providerSession, id),
    ).resolves.toBe("erased");
    expect(send).toHaveBeenCalledWith(
      "https://verification.didit.me/v3/session/" +
        providerSession +
        "/delete/",
      expect.objectContaining({
        method: "DELETE",
        redirect: "manual",
        body: JSON.stringify({
          deletion_instruction: "privacy_erasure",
          retain_face_embeddings: false,
          instruction_id: id,
        }),
      }),
    );
  });

  it.each([404, 503])(
    "keeps an unconfirmed job pending when Didit returns %s",
    async (status) => {
      const send = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status }));
      await expect(
        makeDiditEraser(env, send)?.(providerSession, id),
      ).resolves.toBeNull();
    },
  );

  it("acknowledges only completed erasures and passes the lease and instruction ID", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          { id, provider_session_id: providerSession, claim_id },
          { id: claim_id, provider_session_id: providerSession, claim_id },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ done: true }] });
    const client = {
      connect: vi.fn(),
      query,
      end: vi.fn().mockResolvedValue(undefined),
    };
    const erase = vi
      .fn()
      .mockResolvedValueOnce("erased")
      .mockResolvedValueOnce(null);
    const result = await purgeDiditSessions(
      { connectionString: "local" },
      () => Promise.resolve(client),
      erase,
    );
    expect(result).toEqual({ erased: 1, retry: 1, configured: true });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("complete_didit_deletion"),
      [id, claim_id],
    );
    expect(erase).toHaveBeenNthCalledWith(1, providerSession, id);
  });
});
