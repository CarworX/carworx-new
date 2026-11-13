import { Client } from "pg";

export interface StepupEnvelope {
  recipientHash: string;
  envelope: string;
  expiresAt: string;
}
export interface EmailStepupDatabase {
  recordReceipt(user: string, session: string): Promise<void>;
  issue(
    user: string,
    session: string,
    challenge: string,
    digest: string,
    mail: StepupEnvelope,
  ): Promise<boolean>;
  verify(
    user: string,
    session: string,
    challenge: string,
    digest: string,
    alert: StepupEnvelope,
  ): Promise<boolean>;
}

/** AUTH_SECURITY_DB is a separate Hyperdrive credential as auth_security_server. */
export function createEmailStepupDatabase(
  connectionString: string,
): EmailStepupDatabase {
  async function query(sql: string, params: unknown[]): Promise<boolean> {
    const client = new Client({
      connectionString,
      application_name: "carworx-auth-security",
      connectionTimeoutMillis: 3000,
      statement_timeout: 3000,
      query_timeout: 3500,
    });
    try {
      await client.connect();
      const result = await client.query<{ ok?: boolean }>(sql, params);
      return result.rows[0]?.ok === true;
    } catch {
      throw new Error("auth_security_unavailable");
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  return {
    async recordReceipt(user, session) {
      await query(
        "select private.record_primary_auth_receipt($1,$2,'password')",
        [user, session],
      );
    },
    issue(user, session, challenge, digest, mail) {
      return query(
        "select private.issue_email_stepup($1,$2,$3,pg_catalog.decode($4,'hex'),$5,$6,$7) as ok",
        [
          user,
          session,
          challenge,
          digest,
          mail.recipientHash,
          mail.envelope,
          mail.expiresAt,
        ],
      );
    },
    verify(user, session, challenge, digest, alert) {
      return query(
        "select private.verify_email_stepup($1,$2,$3,pg_catalog.decode($4,'hex'),$5,$6,$7) as ok",
        [
          user,
          session,
          challenge,
          digest,
          alert.recipientHash,
          alert.envelope,
          alert.expiresAt,
        ],
      );
    },
  };
}
