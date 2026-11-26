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

function expectNeutralCopy(html: string) {
  const visible = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "");
  expect(visible).not.toMatch(/\b(?:sandbox|simulat\w*|test(?:ing)?)\b/i);
}

describe("staging fines payments", () => {
  it("gates fines, reuses checkout, verifies callbacks and protects receipts", async () => {
    const user = await createConfirmedUser("fines-customer");
    const browser = await customer(user.email);
    const path = "/fines/mine";
    const checkout = { form: { intent: "checkout", notice: "GP-2026-118452" } };

    // A6: until the ID check is approved, /fines/mine sends the customer to the
    // verify page instead of showing any notice.
    const gated = await browser.send(path);
    expect(gated.status).toBe(302);
    expect(gated.location).toBe("/fines/verify");
    const verify = await browser.send("/fines/verify");
    expect(verify.status).toBe(200);
    expectNeutralCopy(verify.body);
    expect(verify.body).not.toContain("Speeding notice");
    expect((await browser.send(path, checkout)).status).toBe(403);

    approve(user.id);
    const results = (await browser.send(path)).body;
    expect(results).toContain("Speeding notice");
    expect(results).toContain("GP-2026-118452");
    expect(results).toContain("GP-2026-123817");
    expect(results).toContain("Highveld Metro Traffic");
    expectNeutralCopy(results);
    const started = await browser.send(path, checkout);
    expect(started.status).toBe(302);
    const location = started.location ?? "";
    expect(location).toMatch(/^\/fines\/mine\?payment=[a-f0-9-]+$/);
    expect((await browser.send(path, checkout)).location).toBe(location);
    const id =
      new URL(location, env.APP_ORIGIN).searchParams.get("payment") ?? "";
    const receipt = "CXF-" + id.slice(0, 8).toUpperCase();
    const record = `select status,cents,coalesce(receipt_number,'') from public.fines_payments where id='${id}'`;
    expect(sqlRows(record)).toEqual(["created|45000|"]);
    const checkoutPage = (await browser.send(location + "&status=paid")).body;
    // A created payment shows the checkout state; nothing is "paid" until the issuer confirms.
    expect(checkoutPage).toContain(
      "Checkout started. Waiting for the payment outcome.",
    );
    expectNeutralCopy(checkoutPage);

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
    expect(sqlRows(record)).toEqual([`paid|45000|${receipt}`]);
    expect((await simulate("failed")).status).toBe(302);
    expect((await browser.send(location)).body).toContain(receipt);
    expect(sqlRows(record)).toEqual([`paid|45000|${receipt}`]);

    const other = await createConfirmedUser("fines-other");
    approve(other.id);
    const otherBrowser = await customer(other.email);
    const otherPage = await otherBrowser.send(location);
    expect(otherPage.status).toBe(200);
    expect(otherPage.body).not.toContain(receipt);
    expect(
      (
        await otherBrowser.send(path, {
          form: { intent: "simulate", payment: id, status: "paid" },
        })
      ).status,
    ).toBe(404);
  });
});
