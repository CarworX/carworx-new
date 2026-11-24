import { describe, expect, it, onTestFinished } from "vitest";
import {
  asUser,
  Browser,
  createConfirmedUser,
  createOrganisation,
  signIn,
  sql,
  sqlRows,
} from "./harness";

// Finish-build PR 1 (D-098): real names, role changes, cancelling invites and
// leaving a team, through the real Worker, Auth and PostgreSQL/RLS.
// All identities and business records are synthetic.
async function fixture() {
  const owner = await createConfirmedUser("tm-owner");
  const manager = await createConfirmedUser("tm-manager");
  const staff = await createConfirmedUser("tm-staff");
  const org = await createOrganisation("Team management");
  sql(`insert into public.profiles(id,display_name) values
    ('${owner.id}','Olu Owner Synthetic'),('${manager.id}','Max Manager Synthetic')`);
  sql(`insert into public.memberships(organisation_id,user_id,role,status) values
    ('${org}','${owner.id}','owner','active'),('${org}','${manager.id}','manager','active'),
    ('${org}','${staff.id}','staff','active')`);
  onTestFinished(() => {
    sql(`delete from public.invites where organisation_id='${org}';
      delete from public.memberships where organisation_id='${org}';
      delete from public.organisations where id='${org}'`);
  });
  const membership = (userId: string) =>
    sqlRows(
      `select id from public.memberships where organisation_id='${org}' and user_id='${userId}'`,
    )[0] ?? "";
  return {
    org,
    owner,
    manager,
    staff,
    membership,
    role: (userId: string) =>
      sqlRows(
        `select role || ':' || status from public.memberships where organisation_id='${org}' and user_id='${userId}'`,
      )[0],
    path: (task = "team", step = "start") =>
      `/provider/setup/${task}/${step}?org=${org}`,
  };
}

async function invite(browser: Browser, org: string, role: string) {
  const result = await asUser(browser.session().access_token).rpc(
    "create_invite",
    { p_org: org, p_role: role, p_email: null },
  );
  if (result.error !== null) throw new Error("Synthetic invite failed");
  const id = sqlRows(
    `select id from public.invites where organisation_id='${org}' and role='${role}' order by created_at desc limit 1`,
  )[0];
  if (id === undefined) throw new Error("Synthetic invite missing");
  return id;
}

describe("team management through the Worker", () => {
  it("shows real names to members of that business only", async () => {
    const f = await fixture();
    const owner = await signIn(f.owner.email);
    const team = await owner.send(f.path());
    expect(team.status).toBe(200);
    expect(team.headers.get("Cache-Control")).toBe("private, no-store");
    expect(team.body).toContain("Olu Owner Synthetic (you)");
    expect(team.body).toContain("Max Manager Synthetic");
    expect(team.body).toContain("Name not set yet");
    expect(team.body).not.toContain("Team member ");
    const home = await owner.send("/provider");
    expect(home.body).toContain("Max Manager Synthetic");
    expect(home.body).not.toContain("Team member ");

    const stranger = await signIn((await createConfirmedUser("tm-out")).email);
    const denied = await stranger.send(f.path());
    expect(denied.status).toBe(404);
    expect(denied.body).not.toContain("Max Manager Synthetic");
    const anonymous = await new Browser().send(f.path());
    expect(anonymous.status).toBe(302);
    expect(anonymous.location).toContain("/auth/sign-in");
  });

  it("lets owners change roles, never the last owner, and applies at once", async () => {
    const f = await fixture();
    const owner = await signIn(f.owner.email);
    const manager = await signIn(f.manager.email);
    await manager.send(f.path());

    // Wrong role: a manager cannot change roles.
    const notOwner = await manager.send(f.path(), {
      form: {
        intent: "set-role",
        membership: f.membership(f.staff.id),
        role: "manager",
      },
    });
    expect(notOwner.status).toBe(400);
    expect(f.role(f.staff.id)).toBe("staff:active");

    await owner.send(f.path());
    // CSRF: no token, no change.
    expect(
      (
        await owner.send(f.path(), {
          form: {
            intent: "set-role",
            membership: f.membership(f.manager.id),
            role: "staff",
          },
          csrf: false,
        })
      ).status,
    ).toBe(403);
    expect(f.role(f.manager.id)).toBe("manager:active");

    const demoted = await owner.send(f.path(), {
      form: {
        intent: "set-role",
        membership: f.membership(f.manager.id),
        role: "staff",
      },
    });
    expect(demoted.status).toBe(302);
    expect(f.role(f.manager.id)).toBe("staff:active");
    // Access follows at once: staff cannot open the team page.
    expect((await manager.send(f.path())).status).toBe(404);

    const notOwnerRole = await owner.send(f.path(), {
      form: {
        intent: "set-role",
        membership: f.membership(f.staff.id),
        role: "owner",
      },
    });
    expect(notOwnerRole.status).toBe(400);
    expect(f.role(f.staff.id)).toBe("staff:active");

    const lastOwner = await owner.send(f.path(), {
      form: {
        intent: "set-role",
        membership: f.membership(f.owner.id),
        role: "manager",
      },
    });
    expect(lastOwner.status).toBe(400);
    expect(lastOwner.body).toContain("A business needs at least one owner.");
    expect(f.role(f.owner.id)).toBe("owner:active");
  });

  it("refuses role changes on another business", async () => {
    const f = await fixture();
    const other = await fixture();
    const owner = await signIn(f.owner.email);
    await owner.send(f.path());
    const crossed = await owner.send(f.path(), {
      form: {
        intent: "set-role",
        membership: other.membership(other.manager.id),
        role: "staff",
      },
    });
    expect(crossed.status).toBe(400);
    expect(other.role(other.manager.id)).toBe("manager:active");
  });

  it("cancels invites with the authority that made them", async () => {
    const f = await fixture();
    const owner = await signIn(f.owner.email);
    const managerInvite = await invite(owner, f.org, "manager");
    const staffInvite = await invite(owner, f.org, "staff");
    const manager = await signIn(f.manager.email);
    const page = await manager.send(f.path());
    expect(page.body).toContain(`data-invite="${staffInvite}"`);
    expect(page.body).toContain("Cancel invite");

    expect(
      (
        await manager.send(f.path(), {
          form: { intent: "cancel-invite", invite: managerInvite },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await manager.send(f.path(), {
          form: { intent: "cancel-invite", invite: staffInvite },
          csrf: false,
        })
      ).status,
    ).toBe(403);
    const cancelled = await manager.send(f.path(), {
      form: { intent: "cancel-invite", invite: staffInvite },
    });
    expect(cancelled.status).toBe(302);
    expect(
      sqlRows(
        `select count(*) from public.invites where id in ('${managerInvite}','${staffInvite}')`,
      ),
    ).toEqual(["1"]);

    // Wrong business: an owner elsewhere cannot cancel this invite.
    const other = await fixture();
    const otherOwner = await signIn(other.owner.email);
    await otherOwner.send(other.path());
    expect(
      (
        await otherOwner.send(other.path(), {
          form: { intent: "cancel-invite", invite: managerInvite },
        })
      ).status,
    ).toBe(400);
    expect(
      sqlRows(
        `select count(*) from public.invites where id='${managerInvite}'`,
      ),
    ).toEqual(["1"]);
  });

  it("lets a member leave, but not the last owner", async () => {
    const f = await fixture();
    const staff = await signIn(f.staff.email);
    const work = await staff.send("/account/work");
    expect(work.body).toContain("Leave Team management (synthetic)");
    expect(
      (
        await staff.send("/account/work", {
          form: { intent: "leave", org: f.org },
          csrf: false,
        })
      ).status,
    ).toBe(403);
    expect(f.role(f.staff.id)).toBe("staff:active");
    const left = await staff.send("/account/work", {
      form: { intent: "leave", org: f.org },
    });
    expect(left.status).toBe(200);
    expect(left.body).toContain("You left the business.");
    expect(f.role(f.staff.id)).toBe("staff:revoked");
    expect((await staff.send(f.path("profile"))).status).toBe(404);
    const again = await staff.send("/account/work", {
      form: { intent: "leave", org: f.org },
    });
    expect(again.status).toBe(403);

    const owner = await signIn(f.owner.email);
    await owner.send("/account/work");
    const lastOwner = await owner.send("/account/work", {
      form: { intent: "leave", org: f.org },
    });
    expect(lastOwner.status).toBe(400);
    expect(lastOwner.body).toContain("A business needs at least one owner.");
    expect(f.role(f.owner.id)).toBe("owner:active");
    expect(
      sqlRows(
        `select count(*) from public.audit_log where organisation_id='${f.org}' and target_table='memberships' and action='update'`,
      ),
    ).toEqual(["1"]);
  });
});
