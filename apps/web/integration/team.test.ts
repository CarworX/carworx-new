import { describe, expect, it, onTestFinished } from "vitest";
import {
  APP,
  asUser,
  Browser,
  createConfirmedUser,
  createOrganisation,
  PASSWORD,
  signIn,
  sql,
  sqlRows,
} from "./harness";

// O6: real Worker routing/actions, real Auth and real PostgreSQL/RLS.
// All identities and business records are synthetic.
async function fixture() {
  const owner = await createConfirmedUser("team-owner");
  const manager = await createConfirmedUser("team-manager");
  const org = await createOrganisation("Team flow");
  sql(`insert into public.memberships(organisation_id,user_id,role,status) values
    ('${org}','${owner.id}','owner','active'),('${org}','${manager.id}','manager','active')`);
  const [listing] =
    sqlRows(`insert into public.listings(organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
    values ('${org}','wash','Team flow (synthetic)','Synthetic team integration listing','Gauteng','mobile','live','admin_import','synthetic-team-flow') returning public_id`);
  if (listing === undefined) throw new Error("Missing synthetic listing");
  sql(
    `insert into public.listing_services(listing_public_id,organisation_id,service_slug,position) values ('${listing}','${org}','wash',0)`,
  );
  onTestFinished(() => {
    sql(`delete from public.listings where organisation_id='${org}';
      delete from public.memberships where organisation_id='${org}';
      delete from public.organisations where id='${org}'`);
  });
  const ownerBrowser = await signIn(owner.email);
  return {
    org,
    owner,
    manager,
    ownerBrowser,
    path: (task: string, step = "start") =>
      `/provider/setup/${task}/${step}?org=${org}`,
  };
}

async function invite(
  browser: Browser,
  org: string,
  email: string | null = null,
) {
  const result = await asUser(browser.session().access_token).rpc(
    "create_invite",
    { p_org: org, p_role: "staff", p_email: email },
  );
  if (result.error !== null || typeof result.data !== "string")
    throw new Error("Synthetic invite creation failed");
  return result.data;
}

describe("team setup through the Worker", () => {
  it("creates a one-time link, joins with an own account, saves profile, and loses access on revocation", async () => {
    const f = await fixture();
    const staff = await createConfirmedUser("team-staff");
    const home = await f.ownerBrowser.send("/provider");
    expect(home.status).toBe(200);
    expect(home.body).toContain("Finish setup");
    await f.ownerBrowser.send(f.path("team", "share"));
    const created = await f.ownerBrowser.send(f.path("team", "share"), {
      form: { intent: "create-link", role: "staff" },
    });
    expect(created.status).toBe(200);
    expect(created.headers.get("Cache-Control")).toBe("private, no-store");
    const link =
      /value="(http:\/\/localhost:5173\/join\/[A-Za-z0-9_-]{43})"/.exec(
        created.body,
      )?.[1];
    if (link === undefined) throw new Error("No invite link was rendered");
    const token = new URL(link).pathname.split("/").at(-1) ?? "";
    expect((await f.ownerBrowser.send(f.path("team"))).body).not.toContain(
      token,
    );

    const staffBrowser = await signIn(staff.email);
    const opened = await staffBrowser.send(new URL(link).pathname);
    expect(opened.status).toBe(302);
    expect(opened.location).toBe("/join");
    expect(opened.headers.get("Referrer-Policy")).toBe("no-referrer");
    const join = await staffBrowser.send("/join");
    expect(join.body).not.toContain(token);
    const accepted = await staffBrowser.send("/join", {
      form: { intent: "accept" },
    });
    expect(accepted.status).toBe(302);
    expect(staffBrowser.jar.has("__Host-cx-invite")).toBe(false);
    const staffHome = await staffBrowser.send("/provider");
    expect(staffHome.body).toContain("data-staff-home");
    expect(staffHome.body).not.toContain("Earnings");

    await f.ownerBrowser.send(f.path("assign"));
    expect(
      (
        await f.ownerBrowser.send(f.path("assign"), {
          form: { intent: "save", assignMode: "customer", offerAnyone: "on" },
        })
      ).status,
    ).toBe(302);
    await staffBrowser.send(f.path("profile"));
    expect(
      (
        await staffBrowser.send(f.path("profile"), {
          form: {
            intent: "save",
            firstName: "Synthetic",
            services: ["wash"],
            days: ["1", "3"],
          },
        })
      ).status,
    ).toBe(302);
    expect(
      sqlRows(
        `select p.first_name || ':' || array_to_string(p.days,',') from public.staff_profiles p join public.memberships m on m.id=p.membership_id where m.organisation_id='${f.org}' and m.user_id='${staff.id}'`,
      ),
    ).toEqual(["Synthetic:1,3"]);

    sql(
      `update public.memberships set status='revoked' where organisation_id='${f.org}' and user_id='${staff.id}'`,
    );
    expect((await staffBrowser.send(f.path("profile"))).status).toBe(404);
  });

  it("restricts manager invites and owner visibility settings, and rejects missing CSRF", async () => {
    const f = await fixture();
    const managerBrowser = await signIn(f.manager.email);
    await managerBrowser.send(f.path("team", "share"));
    expect(
      (
        await managerBrowser.send(f.path("team", "share"), {
          form: { intent: "create-link", role: "manager" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await managerBrowser.send(f.path("team", "share"), {
          form: { intent: "create-link", role: "staff" },
        })
      ).status,
    ).toBe(200);
    expect((await managerBrowser.send(f.path("contact"))).status).toBe(404);
    const before = sqlRows(
      `select count(*) from public.invites where organisation_id='${f.org}'`,
    );
    expect(
      (
        await managerBrowser.send(f.path("team", "share"), {
          form: { intent: "create-link", role: "staff" },
          csrf: false,
        })
      ).status,
    ).toBe(403);
    expect(
      sqlRows(
        `select count(*) from public.invites where organisation_id='${f.org}'`,
      ),
    ).toEqual(before);
    const stranger = await createConfirmedUser("team-stranger");
    expect(
      (await (await signIn(stranger.email)).send(f.path("team"))).status,
    ).toBe(404);
  });

  it("strips the token before sign-in and preserves it only in the short-lived secure cookie", async () => {
    const f = await fixture();
    const token = await invite(f.ownerBrowser, f.org);
    const browser = new Browser();
    const opened = await browser.send(`/join/${token}`);
    expect(opened.location).toBe("/join");
    const cookie =
      opened.setCookies.find((value) =>
        value.startsWith("__Host-cx-invite="),
      ) ?? "";
    for (const attribute of [
      "Secure",
      "HttpOnly",
      "SameSite=Lax",
      "Path=/",
      "Max-Age=600",
    ])
      expect(cookie).toContain(attribute);
    const page = await browser.send("/join");
    expect(page.body).toContain("/auth/sign-in?returnTo=%2Fjoin");
    expect(page.body).not.toContain(token);
    const person = await createConfirmedUser("team-signin");
    await browser.send("/auth/sign-in?returnTo=%2Fjoin");
    const signed = await browser.send("/auth/sign-in", {
      form: {
        intent: "password",
        email: person.email,
        password: PASSWORD,
        returnTo: "/join",
      },
    });
    expect(signed.location).toBe("/join");
    expect(browser.jar.get("__Host-cx-invite")).toBe(token);
    expect(
      (await browser.send("/join", { form: { intent: "accept" } })).status,
    ).toBe(302);
    expect(APP).not.toContain(token);
  });

  it("uses the same invalid-invite response for unknown, used, expired and wrong-email tokens", async () => {
    const f = await fixture();
    const person = await createConfirmedUser("team-invalid");
    const browser = await signIn(person.email);
    const tokens = ["x".repeat(43)];
    const used = await invite(f.ownerBrowser, f.org);
    sql(
      `update public.invites set used_at=now(),used_by='${person.id}' where organisation_id='${f.org}' and used_at is null`,
    );
    tokens.push(used);
    const expired = await invite(f.ownerBrowser, f.org);
    sql(
      `update public.invites set created_at=now()-interval '8 days',expires_at=now()-interval '1 day' where organisation_id='${f.org}' and used_at is null`,
    );
    tokens.push(expired);
    const wrongEmail = await invite(f.ownerBrowser, f.org, f.owner.email);
    tokens.push(wrongEmail);
    for (const token of tokens) {
      await browser.send(`/join/${token}`);
      await browser.send("/join");
      const result = await browser.send("/join", {
        form: { intent: "accept" },
      });
      expect(result.status).toBe(400);
      expect(result.body).toContain("This invite cannot be used.");
      expect(result.body).not.toContain(token);
      expect(
        sqlRows(
          `select count(*) from public.memberships where organisation_id='${f.org}' and user_id='${person.id}'`,
        ),
      ).toEqual(["0"]);
    }
  });
});
