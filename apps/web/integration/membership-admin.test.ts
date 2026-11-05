import { describe, expect, it } from "vitest";

import {
  asUser,
  attr,
  Browser,
  createConfirmedUser,
  createOrganisation,
  jwtClaims,
  makePlatformAdmin,
  setMembership,
  signIn,
  totp,
} from "./harness";

// T3 (issue #7): membership revocation and admin TOTP, through the real
// routes, with T2's RLS deciding what the database API returns.

describe("membership revocation", () => {
  it("stops access on the very next request, in the same session", async () => {
    const user = await createConfirmedUser("member");
    const org = await createOrganisation("T3 Revocation Motors");
    const other = await createOrganisation("T3 Someone Else's Wash");
    await setMembership(org, user.id, "active");
    const browser = await signIn(user.email);

    const page = await browser.send(`/org/${org}`);
    expect(page.status).toBe(200);
    expect(page.body).toContain("T3 Revocation Motors (synthetic)");
    expect((await browser.send("/account")).body).toContain(`/org/${org}`);
    expect((await browser.send(`/org/${other}`)).status).toBe(404);

    await setMembership(org, user.id, "revoked");

    const after = await browser.send(`/org/${org}`);
    expect(after.status).toBe(404);
    expect(after.body).not.toContain("T3 Revocation Motors");
    expect((await browser.send("/account")).body).not.toContain(`/org/${org}`);
  });
});

async function enrolTotp(browser: Browser): Promise<string> {
  const start = await browser.send("/auth/mfa?returnTo=%2Fadmin");
  expect(start.status).toBe(200);
  expect(start.body).toContain("Set up an authenticator app");
  const enrolled = await browser.send("/auth/mfa", {
    form: { intent: "enrol", returnTo: "/admin" },
  });
  expect(enrolled.status).toBe(200);
  const secret = attr(enrolled.body, "data-totp-secret");
  const factorId = /name="factorId" value="([^"]+)"/.exec(enrolled.body)?.[1];
  if (secret === undefined || factorId === undefined)
    throw new Error("no enrolment details");

  const wrong = await browser.send("/auth/mfa", {
    form: {
      intent: "verify",
      factorId,
      code: totp(secret) === "000000" ? "111111" : "000000",
      returnTo: "/admin",
    },
  });
  expect(wrong.status).toBe(400);
  expect(wrong.body).toContain('data-problem="invalid_code"');

  const verified = await browser.send("/auth/mfa", {
    form: {
      intent: "verify",
      factorId,
      code: totp(secret),
      returnTo: "/admin",
    },
  });
  expect(verified.status).toBe(302);
  expect(verified.location).toBe("/admin");
  return secret;
}

describe("admin pages need a listed admin AND an aal2 (TOTP) session", () => {
  it("hides /admin from users who aren't on the server-controlled list", async () => {
    const plain = await createConfirmedUser("not-admin");
    expect((await (await signIn(plain.email)).send("/admin")).status).toBe(404);

    // Metadata the user controls never makes anyone an admin.
    const forger = await createConfirmedUser("forger", {
      user_metadata: { is_admin: true, role: "admin" },
    });
    expect((await (await signIn(forger.email)).send("/admin")).status).toBe(
      404,
    );
  });

  it("refuses aal1 at the Worker and the database API, and allows aal2 after TOTP", async () => {
    const user = await createConfirmedUser("admin");
    makePlatformAdmin(user.id);
    await createOrganisation("T3 Admin Visible Garage");
    const browser = await signIn(user.email);

    // Worker: aal1 is sent to the step-up, with no admin data in the reply.
    const refused = await browser.send("/admin");
    expect(refused.status).toBe(302);
    expect(refused.location).toBe("/auth/mfa?returnTo=%2Fadmin");
    expect(refused.body).not.toContain("data-admin-organisations");

    // Database API with the same aal1 token: T2's policies return nothing.
    const aal1 = browser.session().access_token;
    expect(jwtClaims(aal1)["aal"]).toBe("aal1");
    const aal1Orgs = await asUser(aal1).from("organisations").select("id");
    expect(aal1Orgs.error).toBeNull();
    expect(aal1Orgs.data).toEqual([]);
    const aal1Audit = await asUser(aal1)
      .from("audit_log")
      .select("id")
      .limit(1);
    expect(aal1Audit.data ?? []).toEqual([]);

    const secret = await enrolTotp(browser);

    const allowed = await browser.send("/admin");
    expect(allowed.status).toBe(200);
    expect(allowed.headers.get("Cache-Control")).toBe("private, no-store");
    expect(
      Number(attr(allowed.body, "data-admin-organisations")),
    ).toBeGreaterThan(0);

    const aal2 = browser.session().access_token;
    expect(jwtClaims(aal2)["aal"]).toBe("aal2");
    const aal2Orgs = await asUser(aal2).from("organisations").select("id");
    expect(aal2Orgs.data?.length ?? 0).toBeGreaterThan(0);

    // A new sign-in starts at aal1 again and gets the challenge, not enrolment.
    const later = await signIn(user.email);
    expect((await later.send("/admin")).location).toBe(
      "/auth/mfa?returnTo=%2Fadmin",
    );
    const challenge = await later.send("/auth/mfa?returnTo=%2Fadmin");
    expect(challenge.body).not.toContain("Set up an authenticator app");
    const factorId =
      /name="factorId" value="([^"]+)"/.exec(challenge.body)?.[1] ?? "";
    // The next time step: still inside Supabase's skew window, and not a
    // replay of the code used at enrolment.
    const ok = await later.send("/auth/mfa", {
      form: {
        intent: "verify",
        factorId,
        code: totp(secret, 1),
        returnTo: "/admin",
      },
    });
    expect(ok.status).toBe(302);
    expect((await later.send("/admin")).status).toBe(200);
  });

  it("refuses to enrol a second factor from an aal1 session", async () => {
    const user = await createConfirmedUser("admin-second");
    makePlatformAdmin(user.id);
    await enrolTotp(await signIn(user.email));
    const attacker = await signIn(user.email); // e.g. a stolen password, no phone
    const reply = await attacker.send("/auth/mfa", {
      form: { intent: "enrol", returnTo: "/admin" },
    });
    expect(reply.status).toBe(400);
    expect(reply.body).not.toContain("data-totp-secret");
    expect((await attacker.send("/admin")).status).toBe(302);
  });
});
