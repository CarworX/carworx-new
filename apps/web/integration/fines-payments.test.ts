import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  Browser,
  createConfirmedUser,
  sendRaw,
  signIn,
  sql,
  sqlRows,
  stack,
  workerEnv,
} from "./harness";

const env = {
  ...workerEnv,
  CARWORX_ENV: "staging",
  FINES_PROVIDER: "sandbox",
  SEARCH_CURSOR_KEY: `synthetic-fines-${randomUUID()}`,
  FORMS_DB: { connectionString: stack.dbUrl },
};

async function customer(email: string) {
  const signedIn = await signIn(email);
  const browser = new Browser(env);
  for (const [name, value] of signedIn.jar) browser.jar.set(name, value);
  return browser;
}

function approve(userId: string) {
  sql(
    `insert into private.identity_checks(user_id,provider_session_id,status,attempt) values ('${userId}','${randomUUID()}','approved',1)`,
  );
}

describe("staging fines payments", () => {
  it("gates fines, reuses checkout, verifies callbacks and protects receipts", async () => {
    const user = await createConfirmedUser("fines-customer");
    const browser = await customer(user.email);
    const path = "/fines/mine";
    const checkout = { form: { intent: "checkout", notice: "DEMO-101" } };

    const gated = await browser.send(path);
    expect(gated.status).toBe(200);
    expect(gated.body).not.toContain("Speeding notice");
    expect((await browser.send(path, checkout)).status).toBe(403);

    approve(user.id);
    expect((await browser.send(path)).body).toContain("Speeding notice");
    const started = await browser.send(path, checkout);
    expect(started.status).toBe(302);
    const location = started.location ?? "";
    expect(location).toMatch(/^\/fines\/mine\?payment=[a-f0-9-]+$/);
    expect((await browser.send(path, checkout)).location).toBe(location);
    const id =
      new URL(location, env.APP_ORIGIN).searchParams.get("payment") ?? "";
    const record = `select status,cents,coalesce(receipt_number,'') from public.fines_payments where id='${id}'`;
    expect(sqlRows(record)).toEqual(["created|45000|"]);
    expect((await browser.send(location + "&status=paid")).body).toContain(
      "Awaiting issuer confirmation",
    );

    const callback = await sendRaw(
      new Request(new URL("/api/fines/callback", env.APP_ORIGIN), {
        method: "POST",
        body: JSON.stringify({ paymentId: id, status: "paid" }),
      }),
      env,
    );
    expect(callback.status).toBe(401);
    expect(sqlRows(record)).toEqual(["created|45000|"]);

    const simulate = (status: string) =>
      browser.send(path, { form: { intent: "simulate", payment: id, status } });
    expect((await simulate("pending_issuer")).status).toBe(302);
    expect(sqlRows(record)).toEqual(["pending_issuer|45000|"]);
    expect((await simulate("paid")).status).toBe(302);
    expect(sqlRows(record)).toEqual([`paid|45000|DEMO-${id}`]);
    expect((await simulate("failed")).status).toBe(302);
    expect((await browser.send(location)).body).toContain(`DEMO-${id}`);
    expect(sqlRows(record)).toEqual([`paid|45000|DEMO-${id}`]);

    const other = await createConfirmedUser("fines-other");
    approve(other.id);
    const otherBrowser = await customer(other.email);
    const otherPage = await otherBrowser.send(location);
    expect(otherPage.status).toBe(200);
    expect(otherPage.body).not.toContain(`DEMO-${id}`);
    expect(
      (
        await otherBrowser.send(path, {
          form: { intent: "simulate", payment: id, status: "paid" },
        })
      ).status,
    ).toBe(404);
  });
});
