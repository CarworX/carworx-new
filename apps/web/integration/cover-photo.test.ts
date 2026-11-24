import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, onTestFinished } from "vitest";

import {
  attr,
  Browser,
  createConfirmedUser,
  createOrganisation,
  makePlatformAdmin,
  media,
  signIn,
  sql,
  sqlRows,
  totp,
} from "./harness";

// Finish-build PR 3 (D-098): cover photos through the built Worker, real
// Auth and PostgreSQL/RLS, with an in-memory MEDIA bucket. Synthetic data and
// synthetic images only (app/server/media/fixtures/make.py).

const FIXTURES = join(
  import.meta.dirname,
  "..",
  "app",
  "server",
  "media",
  "fixtures",
);
const file = (name: string, as = name, type = "image/jpeg") =>
  new File([readFileSync(join(FIXTURES, name))], as, { type });
const text = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

async function fixture(label = "cover") {
  const owner = await createConfirmedUser(`${label}-owner`);
  const staff = await createConfirmedUser(`${label}-staff`);
  const org = await createOrganisation(`Cover ${label}`);
  sql(`insert into public.memberships(organisation_id,user_id,role) values
    ('${org}','${owner.id}','owner'),('${org}','${staff.id}','staff')`);
  const [listing] =
    sqlRows(`insert into public.listings(organisation_id,service_slug,display_name,description,metro,mode,status,provenance_kind,provenance_reference)
    values ('${org}','wash','Cover ${label} (synthetic)','Synthetic cover listing','Gauteng','mobile','live','admin_import','synthetic-cover') returning public_id`);
  if (listing === undefined) throw new Error("Missing synthetic listing");
  onTestFinished(() => {
    sql(`delete from public.listings where organisation_id='${org}';
      delete from public.memberships where organisation_id='${org}';
      delete from public.organisations where id='${org}'`);
  });
  const path = `/provider/setup/cover/start?org=${org}`;
  return { org, owner, staff, listing, path };
}

function upload(listing: string, photo: File) {
  const form = new FormData();
  form.set("intent", "upload-cover");
  form.set("listing", listing);
  form.set("photo", photo);
  return form;
}

const coverKey = (listing: string) =>
  sqlRows(
    `select object_key from public.listing_covers where listing_public_id='${listing}'`,
  )[0];

async function stepUp(browser: Browser): Promise<void> {
  await browser.send("/auth/mfa?returnTo=%2Fadmin");
  const enrolled = await browser.send("/auth/mfa", {
    form: { intent: "enrol", returnTo: "/admin" },
  });
  const secret = attr(enrolled.body, "data-totp-secret");
  const factorId = /name="factorId" value="([^"]+)"/.exec(enrolled.body)?.[1];
  if (secret === undefined || factorId === undefined)
    throw new Error("no enrolment details");
  const verified = await browser.send("/auth/mfa", {
    form: {
      intent: "verify",
      factorId,
      code: totp(secret),
      returnTo: "/admin",
    },
  });
  if (verified.status !== 302) throw new Error("TOTP step-up failed");
}

describe("cover photos through the Worker", () => {
  it("uploads a photo, strips its GPS and shows it on the listing at once", async () => {
    const f = await fixture("show");
    const owner = await signIn(f.owner.email);
    const page = await owner.send(f.path);
    expect(page.status).toBe(200);
    expect(page.body).toMatch(/encType="multipart\/form-data"/i);
    const saved = await owner.send(f.path, {
      multipart: upload(f.listing, file("gps.jpg")),
    });
    expect(saved.status).toBe(302);
    const key = coverKey(f.listing) ?? "";
    expect(key).toMatch(/^covers\/[0-9a-f]{32}\.jpg$/);
    const stored = media.get(key);
    expect(stored?.type).toBe("image/jpeg");
    expect(text(stored?.bytes ?? new Uint8Array())).not.toContain("SECRET");

    const listing = await new Browser().send(`/p/${f.listing}`);
    expect(listing.body).toContain(`src="/media/${key}"`);
    const image = await new Browser().send(`/media/${key}`);
    expect(image.status).toBe(200);
    expect(image.headers.get("Content-Type")).toBe("image/jpeg");
    expect(image.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(image.headers.get("Cache-Control")).toContain("immutable");
    expect(image.bytes).toEqual(stored?.bytes);
    expect(text(image.bytes)).not.toContain("SECRET");
  });

  it("keeps one cover per listing and queues the replaced file", async () => {
    const f = await fixture("replace");
    const owner = await signIn(f.owner.email);
    await owner.send(f.path);
    await owner.send(f.path, { multipart: upload(f.listing, file("gps.jpg")) });
    const first = coverKey(f.listing) ?? "";
    await owner.send(f.path, {
      multipart: upload(f.listing, file("meta.png", "photo.png", "image/png")),
    });
    const second = coverKey(f.listing) ?? "";
    expect(second).toMatch(/\.png$/);
    expect(second).not.toBe(first);
    expect(
      sqlRows(
        `select reason from private.media_deletions where object_key='${first}'`,
      ),
    ).toEqual(["replaced"]);
    expect((await new Browser().send(`/media/${first}`)).status).toBe(404);
    expect((await new Browser().send(`/media/${second}`)).status).toBe(200);
  });

  it("refuses fake extensions, oversize files, animations and wrong owners, storing nothing", async () => {
    const f = await fixture("refuse");
    const owner = await signIn(f.owner.email);
    await owner.send(f.path);
    const before = media.size;
    for (const photo of [
      file("not-an-image.jpg"),
      file("animated.png", "a.png", "image/png"),
      file("too-wide.png", "w.png", "image/png"),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", {
        type: "image/jpeg",
      }),
    ]) {
      const refused = await owner.send(f.path, {
        multipart: upload(f.listing, photo),
      });
      expect(refused.status).toBe(400);
    }
    // Another business's listing: refused before anything is stored.
    const other = await fixture("other");
    const crossed = await owner.send(f.path, {
      multipart: upload(other.listing, file("gps.jpg")),
    });
    expect(crossed.status).toBe(400);
    expect(coverKey(other.listing)).toBeUndefined();
    expect(media.size).toBe(before);
    expect(coverKey(f.listing)).toBeUndefined();
  });

  it("needs an owner or manager, a session and a CSRF token", async () => {
    const f = await fixture("authz");
    const staff = await signIn(f.staff.email);
    expect((await staff.send(f.path)).status).toBe(404);
    const anonymous = await new Browser().send(f.path);
    expect(anonymous.status).toBe(302);
    expect(anonymous.location).toContain("/auth/sign-in");
    const owner = await signIn(f.owner.email);
    await owner.send(f.path);
    const noCsrf = await owner.send(f.path, {
      multipart: upload(f.listing, file("gps.jpg")),
      csrf: false,
    });
    expect(noCsrf.status).toBe(403);
    expect(coverKey(f.listing)).toBeUndefined();
  });

  it("lets an aal2 admin take a cover down, audited and at once", async () => {
    const f = await fixture("admin");
    const owner = await signIn(f.owner.email);
    await owner.send(f.path);
    await owner.send(f.path, { multipart: upload(f.listing, file("gps.jpg")) });
    const key = coverKey(f.listing) ?? "";

    const person = await createConfirmedUser("cover-admin");
    makePlatformAdmin(person.id);
    const admin = await signIn(person.email);
    await stepUp(admin);
    const page = await admin.send(`/admin/listings/${f.listing}`);
    expect(page.body).toContain("Remove photo");
    const removed = await admin.send(`/admin/listings/${f.listing}`, {
      form: { intent: "remove-cover" },
    });
    expect(removed.status).toBe(302);
    expect(coverKey(f.listing)).toBeUndefined();
    expect((await new Browser().send(`/media/${key}`)).status).toBe(404);
    expect((await new Browser().send(`/p/${f.listing}`)).body).not.toContain(
      key,
    );
    expect(
      sqlRows(`select details->>'state' || ':' || (details->>'by_admin') from public.audit_log
        where target_table='listing_covers' and action='delete' and organisation_id='${f.org}'`),
    ).toEqual(["removed:true"]);

    // An owner cannot use the admin action.
    const notAdmin = await owner.send(`/admin/listings/${f.listing}`, {
      form: { intent: "remove-cover" },
    });
    expect(notAdmin.status).toBe(404);
  });
});
