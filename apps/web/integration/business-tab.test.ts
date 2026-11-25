import { describe, expect, it, onTestFinished } from "vitest";

import {
  Browser,
  createConfirmedUser,
  createOrganisation,
  signIn,
  sql,
  sqlRows,
} from "./harness";

// Finish-build PR 5 (D-098): Account › Business through the built Worker,
// real Auth and PostgreSQL. Transfer ownership (the new owner accepts) and
// close a listing. Wrong role, wrong business, signed out and CSRF for each
// action. Synthetic people and businesses only.
const PATH = "/account/business";

async function business(label: string) {
  const org = await createOrganisation(`Business ${label}`);
  const owner = await createConfirmedUser(`${label}-owner`);
  const manager = await createConfirmedUser(`${label}-manager`);
  const staff = await createConfirmedUser(`${label}-staff`);
  sql(`insert into public.profiles(id, display_name) values
      ('${owner.id}', 'Owner ${label} (synthetic)'), ('${manager.id}', 'Manager ${label} (synthetic)');
    insert into public.memberships(organisation_id,user_id,role) values
      ('${org}','${owner.id}','owner'),('${org}','${manager.id}','staff'),('${org}','${staff.id}','staff');
    update public.memberships set role='manager' where organisation_id='${org}' and user_id='${manager.id}'`);
  const [live, held] =
    sqlRows(`insert into public.listings(organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
    values ('${org}','wash','Live ${label} (synthetic)','Synthetic live listing','Gauteng','mobile','live','admin_import','synthetic-business'),
           ('${org}','wash','Held ${label} (synthetic)','Synthetic suspended listing','Gauteng','mobile','suspended','admin_import','synthetic-business')
    returning public_id`);
  if (live === undefined || held === undefined)
    throw new Error("Missing synthetic listings");
  onTestFinished(() => {
    sql(`delete from public.listings where organisation_id='${org}';
      delete from public.memberships where organisation_id='${org}';
      delete from public.organisations where id='${org}'`);
  });
  const membership = (userId: string) =>
    sqlRows(
      `select id from public.memberships where organisation_id='${org}' and user_id='${userId}'`,
    )[0] ?? "";
  const role = (userId: string) =>
    sqlRows(
      `select role from public.memberships where organisation_id='${org}' and user_id='${userId}'`,
    )[0];
  return { org, owner, manager, staff, live, held, membership, role };
}

describe("Account › Business", () => {
  it("hands the business to a manager, who must accept", async () => {
    const b = await business("transfer");
    const owner = await signIn(b.owner.email);
    const page = await owner.send(PATH);
    expect(page.status).toBe(200);
    expect(page.body).toContain("Transfer ownership");
    expect(page.body).toContain(`Manager transfer (synthetic) (Manager)`);

    const offered = await owner.send(PATH, {
      form: {
        intent: "offer-ownership",
        org: b.org,
        membership: b.membership(b.manager.id),
      },
    });
    expect(offered.status).toBe(200);
    expect(offered.body).toContain("Offer sent");
    expect((await owner.send(PATH)).body).toContain(
      "Offered to Manager transfer (synthetic)",
    );
    // Nothing changes until the manager accepts.
    expect(b.role(b.owner.id)).toBe("owner");

    // Someone else on the team cannot accept it, or see it.
    const staff = await signIn(b.staff.email);
    await staff.send(PATH);
    const notTheirs = await staff.send(PATH, {
      form: { intent: "accept-offer", org: b.org },
    });
    expect(notTheirs.status).toBe(409);
    expect(b.role(b.staff.id)).toBe("staff");

    const manager = await signIn(b.manager.email);
    const offer = await manager.send(PATH);
    expect(offer.body).toContain("Become the owner of Business transfer");
    expect(offer.body).toContain("Owner transfer (synthetic) wants to hand");
    // No CSRF: refused before anything runs.
    const forged = await manager.send(PATH, {
      form: { intent: "accept-offer", org: b.org },
      csrf: false,
    });
    expect(forged.status).toBe(403);
    expect(b.role(b.manager.id)).toBe("manager");

    const accepted = await manager.send(PATH, {
      form: { intent: "accept-offer", org: b.org },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toContain("You're now the owner");
    expect(b.role(b.manager.id)).toBe("owner");
    expect(b.role(b.owner.id)).toBe("manager");
    // The old owner now sees the manager view: no ownership controls.
    const after = await owner.send(PATH);
    expect(after.body).not.toContain("Transfer ownership");
    expect(after.body).toContain("Leave this business");
  });

  it("refuses the wrong role, the wrong business and signed-out visitors", async () => {
    const b = await business("guard");
    const other = await business("other");
    const manager = await signIn(b.manager.email);
    await manager.send(PATH);
    const byManager = await manager.send(PATH, {
      form: {
        intent: "offer-ownership",
        org: b.org,
        membership: b.membership(b.staff.id),
      },
    });
    expect(byManager.status).toBe(403);

    // An owner elsewhere cannot offer this business, or close its listing.
    const outsider = await signIn(other.owner.email);
    await outsider.send(PATH);
    const wrongOffer = await outsider.send(PATH, {
      form: {
        intent: "offer-ownership",
        org: b.org,
        membership: b.membership(b.staff.id),
      },
    });
    expect(wrongOffer.status).toBe(403);
    const wrongClose = await outsider.send(PATH, {
      form: { intent: "close-listing", listing: b.live, understand: "on" },
    });
    expect(wrongClose.status).toBe(403);
    expect(
      sqlRows(`select status from public.listings where public_id='${b.live}'`),
    ).toEqual(["live"]);
    expect(
      sqlRows(
        `select count(*) from private.ownership_offers where organisation_id='${b.org}'`,
      ),
    ).toEqual(["0"]);

    const visitor = new Browser();
    const signedOut = await visitor.send(PATH);
    expect(signedOut.status).toBe(302);
    expect(signedOut.location).toContain("/auth/sign-in");
  });

  it("closes a listing: out of search at once, history kept", async () => {
    const b = await business("close");
    const owner = await signIn(b.owner.email);
    expect((await new Browser().send(`/p/${b.live}`)).status).toBe(200);
    await owner.send(PATH);

    const unticked = await owner.send(PATH, {
      form: { intent: "close-listing", listing: b.live },
    });
    expect(unticked.status).toBe(400);
    const manager = await signIn(b.manager.email);
    await manager.send(PATH);
    const byManager = await manager.send(PATH, {
      form: { intent: "close-listing", listing: b.live, understand: "on" },
    });
    expect(byManager.status).toBe(403);
    const forged = await owner.send(PATH, {
      form: { intent: "close-listing", listing: b.live, understand: "on" },
      csrf: false,
    });
    expect(forged.status).toBe(403);
    const suspended = await owner.send(PATH, {
      form: { intent: "close-listing", listing: b.held, understand: "on" },
    });
    expect(suspended.status).toBe(409);
    expect(
      sqlRows(`select status from public.listings where public_id='${b.held}'`),
    ).toEqual(["suspended"]);

    const closed = await owner.send(PATH, {
      form: { intent: "close-listing", listing: b.live, understand: "on" },
    });
    expect(closed.status).toBe(200);
    expect(closed.body).toContain("out of search");
    expect(
      sqlRows(`select status from public.listings where public_id='${b.live}'`),
    ).toEqual(["draft"]);
    expect((await new Browser().send(`/p/${b.live}`)).status).toBe(404);
    expect(
      sqlRows(
        `select details->>'event' from public.audit_log where target_table='listing_closures' and target_id='${b.live}'`,
      ),
    ).toEqual(["closed_by_owner"]);
    const provider = await owner.send("/provider");
    expect(provider.body).toContain("You closed this listing");
  });
});
