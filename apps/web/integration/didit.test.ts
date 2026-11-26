import { createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createConfirmedUser, sendRaw, sql, sqlRows, stack } from "./harness";

const url = "https://test.example/api/identity/didit";
const secret = "synthetic-didit-webhook-secret";
const workflow = "0ccc342d-6da5-4a68-9c34-28101b2b727b";
const env = {
  CARWORX_ENV: "staging",
  DIDIT_WEBHOOK_SECRET: secret,
  DIDIT_WORKFLOW_ID: workflow,
  FORMS_DB: { connectionString: stack.dbUrl },
};

function event(
  session: string,
  status: string,
  signingKey = secret,
  age = 0,
  personalNumber: string | null = "9001010009081",
) {
  const timestamp = Math.floor(Date.now() / 1000) - age;
  const body = JSON.stringify({
    decision: {
      id_verifications: [
        {
          document_number: "P00001234",
          ...(personalNumber === null
            ? {}
            : { personal_number: personalNumber }),
          status: "Approved",
        },
      ],
    },
    session_id: session,
    status,
    timestamp,
    webhook_type: "status.updated",
    workflow_id: workflow,
  });
  return new Request(url, {
    method: "POST",
    headers: {
      "X-Timestamp": String(timestamp),
      "X-Signature-V2": createHmac("sha256", signingKey)
        .update(body)
        .digest("hex"),
    },
    body,
  });
}

describe("Didit identity webhook", () => {
  it.each([
    ["In Progress", "in_progress"],
    ["In Review", "in_review"],
    ["Approved", "approved"],
    ["Declined", "declined"],
  ])("records %s and treats replay as a no-op", async (status, expected) => {
    const user = await createConfirmedUser("didit");
    const session = randomUUID();
    sql(
      `select private.identity_start('${user.id}', '${session}', 1::smallint)`,
    );
    expect((await sendRaw(event(session, status), env)).status).toBe(200);
    const query = `select status, id_last4, updated_at from private.identity_checks where provider_session_id = '${session}'`;
    const before = sqlRows(query);
    expect(before[0]).toMatch(new RegExp(`^${expected}[|]`));
    expect(before[0]).toContain("|9081|");
    expect((await sendRaw(event(session, status), env)).status).toBe(200);
    expect(sqlRows(query)).toEqual(before);
  });

  it.each([null, "9001010009087", "1234"])(
    "stores null for an absent or invalid personal number (%s)",
    async (personalNumber) => {
      const user = await createConfirmedUser("didit-id");
      const session = randomUUID();
      sql(
        `select private.identity_start('${user.id}', '${session}', 1::smallint)`,
      );
      expect(
        (
          await sendRaw(
            event(session, "Approved", secret, 0, personalNumber),
            env,
          )
        ).status,
      ).toBe(200);
      expect(
        sqlRows(
          `select (id_last4 is null)::text from private.identity_checks where provider_session_id = '${session}'`,
        ),
      ).toEqual(["true"]);
    },
  );

  it("expires an approval and makes the next check attempt one", async () => {
    const user = await createConfirmedUser("didit-expiry");
    const session = randomUUID();
    const next = randomUUID();
    sql(
      `select private.identity_start('${user.id}', '${session}', 1::smallint)`,
    );
    expect((await sendRaw(event(session, "Approved"), env)).status).toBe(200);
    expect((await sendRaw(event(session, "Kyc Expired"), env)).status).toBe(
      200,
    );
    expect(
      sqlRows(
        `select status from private.identity_checks where provider_session_id = '${session}'`,
      ),
    ).toEqual(["expired"]);
    sql(`select private.identity_start('${user.id}', '${next}', 1::smallint)`);
    expect((await sendRaw(event(session, "Kyc Expired"), env)).status).toBe(
      200,
    );
    expect(
      sqlRows(
        `select attempt from private.identity_checks where provider_session_id = '${next}'`,
      ),
    ).toEqual(["1"]);
  });

  it("does not reset attempts when an unfinished session expires", async () => {
    const user = await createConfirmedUser("didit-session-timeout");
    const session = randomUUID();
    sql(
      `select private.identity_start('${user.id}', '${session}', 1::smallint)`,
    );
    expect((await sendRaw(event(session, "Expired"), env)).status).toBe(200);
    expect(
      sqlRows(`select private.identity_next_attempt('${user.id}')`),
    ).toEqual(["2"]);
  });

  it("refuses invalid signatures, stale deliveries, GET and subpaths", async () => {
    expect(
      (await sendRaw(event(randomUUID(), "Approved", "wrong-key"), env)).status,
    ).toBe(401);
    expect(
      (await sendRaw(event(randomUUID(), "Approved", secret, 301), env)).status,
    ).toBe(401);
    expect((await sendRaw(new Request(url), env)).status).toBe(404);
    expect(
      (await sendRaw(new Request(url + "/extra", { method: "POST" }), env))
        .status,
    ).toBe(404);
  });
});
