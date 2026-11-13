import { randomUUID } from "node:crypto";

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
} from "vitest";

import {
  Browser,
  createConfirmedUser,
  createOrganisation,
  signIn,
  sql,
  sqlRows,
  stack,
  workerEnv,
} from "./harness";
import { apply } from "./onboarding";

// Claude 26: per-day opening hours through the built Worker, real Auth and
// real PostgreSQL/RLS. The public page reads through the real scoped
// catalogue_server login. All identities and businesses are synthetic.
const password = `synthetic-${randomUUID()}`;
function login(): string {
  const url = new URL(stack.dbUrl);
  url.username = "catalogue_server";
  url.password = password;
  return url.toString();
}
beforeAll(() => {
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sql(
    `alter role catalogue_server password '${password}' valid until '${until}'`,
  );
});
afterAll(() => {
  sql("alter role catalogue_server password null");
});

const visitor = (catalogue = true): Browser =>
  new Browser({
    ...workerEnv,
    ...(catalogue ? { CATALOGUE_DB: { connectionString: login() } } : {}),
  } as unknown as typeof workerEnv & Record<string, string>);

/** Monday to Friday 08:00–17:00 and Saturday 08:00–13:00, as posted. */
const WEEK: Record<string, string> = {};
for (let day = 1; day <= 7; day++) {
  if (day <= 6) WEEK[`open-${String(day)}`] = "on";
  WEEK[`opens-${String(day)}`] = "08:00";
  WEEK[`closes-${String(day)}`] = day === 6 ? "13:00" : "17:00";
}

async function fixture(status = "live") {
  const owner = await createConfirmedUser("hours-owner");
  const manager = await createConfirmedUser("hours-manager");
  const staff = await createConfirmedUser("hours-staff");
  const outsider = await createConfirmedUser("hours-outsider");
  const org = await createOrganisation("Hours flow");
  const other = await createOrganisation("Hours other");
  sql(`insert into public.memberships(organisation_id,user_id,role,status) values
    ('${org}','${owner.id}','owner','active'),('${org}','${manager.id}','manager','active'),
    ('${org}','${staff.id}','staff','active'),('${other}','${outsider.id}','owner','active')`);
  const [listing] =
    sqlRows(`insert into public.listings(organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
    values ('${org}','wash','Hours flow (synthetic)','Synthetic opening hours listing','Gauteng','mobile','${status}','admin_import','synthetic-hours-flow') returning public_id`);
  if (listing === undefined) throw new Error("Missing synthetic listing");
  onTestFinished(() => {
    sql(`delete from public.listings where organisation_id in ('${org}','${other}');
      delete from public.memberships where organisation_id in ('${org}','${other}');
      delete from public.organisations where id in ('${org}','${other}')`);
  });
  return { org, listing, owner, manager, staff, outsider };
}

const saved = (listing: string) =>
  sqlRows(
    `select day || ' ' || to_char(opens,'HH24:MI') || '-' || to_char(closes,'HH24:MI') from public.listing_hours where listing_public_id='${listing}' order by day`,
  );

describe("editing opening hours after listing", () => {
  it("lets the owner set each day, copy Monday and see it on the listing", async () => {
    const f = await fixture();
    const owner = await signIn(f.owner.email);
    const path = `/provider/hours/${f.listing}`;

    const home = await owner.send("/provider");
    expect(home.body).toContain(`href="${path}"`);

    const page = await owner.send(path);
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.body).toContain("No hours on your listing yet.");
    expect(page.body).toContain('name="open-7"');

    // Copy Monday redraws without saving.
    const copied = await owner.send(path, {
      form: {
        ...WEEK,
        intent: "save",
        "opens-1": "07:00",
        "closes-1": "18:00",
        hoursAction: "copy-monday",
      },
    });
    expect(copied.status).toBe(200);
    expect(saved(f.listing)).toEqual([]);
    expect(
      (copied.body.match(/<option value="07:00" selected="">/g) ?? []).length,
    ).toBe(5);

    const bad = await owner.send(path, {
      form: { ...WEEK, intent: "save", "closes-6": "07:00" },
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toContain(
      "Saturday: closing time must be after opening time.",
    );
    expect(saved(f.listing)).toEqual([]);

    const ok = await owner.send(path, {
      form: {
        ...WEEK,
        intent: "save",
        "opens-5": "07:30",
        "closes-5": "16:00",
      },
    });
    expect(ok.status).toBe(302);
    expect(ok.location).toBe(`${path}?saved=1`);
    expect(saved(f.listing)).toEqual([
      "1 08:00-17:00",
      "2 08:00-17:00",
      "3 08:00-17:00",
      "4 08:00-17:00",
      "5 07:30-16:00",
      "6 08:00-13:00",
    ]);
    expect(
      sqlRows(
        `select count(*) from public.audit_log where target_table='listing_hours' and actor_id='${f.owner.id}'`,
      ),
    ).toEqual(["6"]);

    const listing = await visitor().send(`/p/${f.listing}`);
    expect(listing.status).toBe(200);
    expect(listing.body).toContain("Opening hours");
    expect(listing.body).toContain("07:30 – 16:00");
    expect(listing.body).toContain("08:00 – 13:00");
    expect(listing.body).toMatch(
      /<th scope="row">Sunday<\/th><td>Closed<\/td>/,
    );
    expect((listing.body.match(/aria-current="date"/g) ?? []).length).toBe(1);
    expect(listing.body).toMatch(/data-open-status="(open|closed)"/);
    expect(listing.body).toContain("Public holiday hours may differ");
  });

  it("lets a manager save, shows staff a read-only view and refuses their post", async () => {
    const f = await fixture();
    const path = `/provider/hours/${f.listing}`;
    const manager = await signIn(f.manager.email);
    await manager.send(path);
    expect(
      (await manager.send(path, { form: { ...WEEK, intent: "save" } })).status,
    ).toBe(302);
    expect(saved(f.listing)).toHaveLength(6);

    const staff = await signIn(f.staff.email);
    const view = await staff.send(path);
    expect(view.status).toBe(200);
    expect(view.body).toContain("View only.");
    expect(view.body).not.toContain('name="open-1"');
    expect(view.body).toContain("08:00 – 13:00");
    const refused = await staff.send(path, {
      form: { intent: "save" },
    });
    expect(refused.status).toBe(403);
    expect(saved(f.listing)).toHaveLength(6);
  });

  it("is not found for another business and for a bad ID", async () => {
    const f = await fixture();
    const outsider = await signIn(f.outsider.email);
    expect((await outsider.send(`/provider/hours/${f.listing}`)).status).toBe(
      404,
    );
    await outsider.send("/provider");
    expect(
      (
        await outsider.send(`/provider/hours/${f.listing}`, {
          form: { ...WEEK, intent: "save" },
        })
      ).status,
    ).toBe(404);
    expect(saved(f.listing)).toEqual([]);
    expect((await outsider.send("/provider/hours/not-a-uuid")).status).toBe(
      404,
    );
  });
});

describe("opening hours on the public listing", () => {
  it("says hours aren't provided, and never fails the page without the database", async () => {
    const f = await fixture();
    const none = await visitor().send(`/p/${f.listing}`);
    expect(none.status).toBe(200);
    expect(none.body).toContain("Hours not provided.");
    sql(`insert into public.listing_hours(listing_public_id,organisation_id,day,opens,closes)
      values ('${f.listing}','${f.org}',1,'08:00','17:00')`);
    const down = await visitor(false).send(`/p/${f.listing}`);
    expect(down.status).toBe(200);
    expect(down.body).toContain(
      "Opening hours aren&#x27;t available right now.",
    );
    expect(down.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("opening hours in the application", () => {
  it("keeps each day's own times from the About step through to the listing", async () => {
    const user = await createConfirmedUser("hours-applicant");
    const browser = await signIn(user.email);
    onTestFinished(() => {
      sql(`delete from public.listings where organisation_id in
          (select organisation_id from public.memberships where user_id='${user.id}');
        delete from public.provider_applications where user_id='${user.id}'`);
    });
    const sent = await apply(browser, {
      businessName: "Hours Motors (synthetic)",
      service: "service",
      mode: "fixed",
      metro: "Gauteng",
      description: "Synthetic workshop for opening hours",
      address: "7 Synthetic Lane, Exampleville",
      latitude: "-26.1002",
      longitude: "28.0403",
      confirm: "on",
    });
    expect(sent.status).toBe(302);
    const [listing] = sqlRows(
      `select submitted_listing_public_id from public.provider_applications where user_id='${user.id}'`,
    );
    expect(saved(listing ?? "")).toEqual([
      "1 08:00-17:00",
      "2 08:00-17:00",
      "3 08:00-17:00",
      "4 08:00-17:00",
      "5 08:00-17:00",
      "6 08:00-13:00",
    ]);
  });
});
