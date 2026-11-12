import { Client } from "pg";

import type { ClaimedMail, MailDatabase } from "./outbox.server";

/** Use MAIL_DB Hyperdrive with mail_server, never the broad service-role key. */
export function createMailDatabase(connectionString: string): MailDatabase {
  async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
    const client = new Client({
      connectionString,
      application_name: "carworx-mail",
      connectionTimeoutMillis: 3_000,
      statement_timeout: 3_000,
      query_timeout: 3_500,
    });
    try {
      await client.connect();
      const result = await client.query(sql, params);
      return result.rows as T[];
    } catch {
      throw new Error("mail_database_unavailable");
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  return {
    async enqueue(key, template, recipientHash, envelope, expiresAt) {
      const rows = await query<{ id: string }>(
        "select private.enqueue_mail($1,$2,$3,$4,$5) as id",
        [key, template, recipientHash, envelope, expiresAt],
      );
      if (rows[0] === undefined) throw new Error("mail_database_unavailable");
      return rows[0].id;
    },
    async purge() {
      return (
        (
          await query<{ count: number }>(
            "select private.purge_expired_mail() as count",
            [],
          )
        )[0]?.count ?? 0
      );
    },
    async claim(limit) {
      return (
        (
          await query<ClaimedMail>(
            "select id,logical_key,template,encrypted_payload,expires_at::text as expires_at,lease_token,attempts from private.claim_mail($1)",
            [limit],
          )
        )[0] ?? null
      );
    },
    async finish(id, lease, result, providerId) {
      return (
        (
          await query<{ ok: boolean }>(
            "select private.finish_mail($1,$2,$3,$4) as ok",
            [id, lease, result, providerId ?? null],
          )
        )[0]?.ok === true
      );
    },
    async delivery(providerId, event) {
      return (
        (
          await query<{ ok: boolean }>(
            "select private.mail_delivery($1,$2) as ok",
            [providerId, event],
          )
        )[0]?.ok === true
      );
    },
  };
}
