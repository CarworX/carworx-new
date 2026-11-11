import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, onTestFinished } from "vitest";

import {
  attr,
  Browser,
  createConfirmedUser,
  makePlatformAdmin,
  signIn,
  sql,
  sqlRows,
  totp,
} from "./harness";

// P2-5 + P2-6 (Claude 22): who reads what the visitor forms stored, and the
// A14 fines rules, through the built Worker. Provider owners and managers
// read their own enquiries; demand and support are admin-at-aal2 only (A13).
// Rows are written directly as fixtures here (the submit path is covered in
// forms.test.ts) and removed in onTestFinished. SYNTHETIC DATA ONLY.

const ADMIN_PATHS = [
  "/admin/demand",
  "/admin/support",
  "/admin/support?status=closed",
];
const TAG = randomUUID().slice(0, 8);

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

/** An organisation with one live listing and an owner, plus a staff member. */
async function provider(label: string) {
  const owner = await createConfirmedUser(`${label}-owner`);
  const staff = await createConfirmedUser(`${label}-staff`);
  const org = randomUUID();
  const listing = randomUUID();
  sql(`
    insert into public.organisations(id, name) values ('${org}', 'Forms ${label} (synthetic)');
    insert into public.memberships(organisation_id, user_id, role, status) values
      ('${org}', '${owner.id}', 'owner', 'active'), ('${org}', '${staff.id}', 'staff', 'active');
    insert into public.listings(public_id, organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      values ('${listing}', '${org}', 'mobile-repair', 'Forms ${label} listing', 'Synthetic description', 'Gauteng', 'mobile', 'live', 'provider_application', 'synthetic-forms');`);
  onTestFinished(() => {
    sql(`
      with gone as (delete from public.enquiries where listing_public_id = '${listing}' returning consent_id)
        delete from public.consents where id in (select consent_id from gone);
      delete from public.listings where public_id = '${listing}';`);
  });
  return { owner, staff, org, listing };
}

function enquiryFixture(listing: string, org: string, message: string) {
  const consent = randomUUID();
  sql(`
    insert into public.consents(id, purpose, notice_version, subject_email)
      values ('${consent}', 'enquiry_share_with_provider', 'privacy-2026-11-11', 'sender-${TAG}@example.test');
    insert into public.enquiries(listing_public_id, organisation_id, sender_name, sender_email, message, consent_id)
      values ('${listing}', '${org}', 'Sam Sender', 'sender-${TAG}@example.test', '${message}', '${consent}');`);
}

function demandFixture(address: string) {
  const consent = randomUUID();
  const id = randomUUID();
  sql(`
    insert into public.consents(id, purpose, notice_version, subject_email)
      values ('${consent}', 'demand_notify', 'privacy-2026-11-11', '${address}');
    insert into public.demand_requests(id, email, category_slug, province, consent_id, last_activity_at, expires_at)
      values ('${id}', '${address}', 'wash-and-detailing', 'limpopo', '${consent}', now(), now() + interval '12 months');`);
  onTestFinished(() => {
    sql(`
      delete from public.demand_requests where email = '${address}';
      delete from public.consents where subject_email = '${address}';`);
  });
  return id;
}

function supportFixture(address: string) {
  const id = randomUUID();
  sql(`insert into public.support_cases(id, email, topic, message)
    values ('${id}', '${address}', 'privacy_request', 'Synthetic support case ${TAG}');`);
  onTestFinished(() => {
    sql(`delete from public.support_cases where id = '${id}';`);
  });
  return id;
}

let admin: Browser;
let adminAal1: Browser;
let stranger: Browser;
beforeAll(async () => {
  const a = await createConfirmedUser("p25-admin");
  makePlatformAdmin(a.id);
  admin = await signIn(a.email);
  await stepUp(admin);
  const b = await createConfirmedUser("p25-admin-aal1");
  makePlatformAdmin(b.id);
  adminAal1 = await signIn(b.email);
  stranger = await signIn((await createConfirmedUser("p25-stranger")).email);
});

describe("provider enquiries inbox", () => {
  it("paginates tied enquiry timestamps without losing older messages or tenant isolation", async () => {
    const mine = await provider("paged-inbox");
    const other = await provider("paged-other");
    enquiryFixture(other.listing, other.org, "Synthetic hidden tenant enquiry");
    const ids = sqlRows(`with c as (
      insert into public.consents(purpose, notice_version, subject_email)
      select 'enquiry_share_with_provider','privacy-2026-11-11','inbox-${TAG}@example.test'
      from generate_series(1,61) returning id)
      insert into public.enquiries(id, listing_public_id, organisation_id, sender_name, sender_email, message, consent_id, created_at)
      select c.id,'${mine.listing}','${mine.org}','Synthetic Sender','inbox-${TAG}@example.test',
      'Synthetic paged enquiry',c.id,timestamptz '2026-11-01 12:00:00.123456+00' from c returning id`);
    const b = await signIn(mine.owner.email);
    let path: string | null = "/provider";
    const seen: string[] = [];
    for (let pages = 0; path !== null; pages++) {
      expect(pages).toBeLessThan(4);
      const page = await b.send(path);
      expect(page.status).toBe(200);
      expect(page.headers.get("Cache-Control")).toBe("private, no-store");
      expect(page.body).not.toContain("Synthetic hidden tenant enquiry");
      const batch = [
        ...page.body.matchAll(/data-enquiry="([0-9a-f-]{36})"/g),
      ].map((m) => m[1] ?? "");
      expect(batch.length).toBeLessThanOrEqual(50);
      seen.push(...batch);
      const tag = /<a\b[^>]*\bdata-enquiries-older\b[^>]*>/.exec(
        page.body,
      )?.[0];
      const next =
        tag === undefined ? undefined : /href="([^"]+)"/.exec(tag)?.[1];
      path = next === undefined ? null : next.replaceAll("&amp;", "&");
    }
    expect(seen).toHaveLength(61);
    expect(new Set(seen)).toEqual(new Set(ids));
    expect((await b.send("/provider?enquiries=invalid")).status).toBe(404);
  });
  it("shows an owner their own listing's enquiries, and nobody else's", async () => {
    const mine = await provider("mine");
    const theirs = await provider("theirs");
    enquiryFixture(mine.listing, mine.org, `Synthetic enquiry for mine ${TAG}`);
    enquiryFixture(
      theirs.listing,
      theirs.org,
      `Synthetic enquiry for theirs ${TAG}`,
    );

    const owner = await signIn(mine.owner.email);
    const page = await owner.send("/provider");
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.body).toContain("data-enquiries");
    expect(page.body).toContain(`Synthetic enquiry for mine ${TAG}`);
    expect(page.body).not.toContain(`Synthetic enquiry for theirs ${TAG}`);
    expect(page.body).toContain(`mailto:sender-${TAG}@example.test`);

    // Staff help run the business but don't read customers' messages.
    const staff = await signIn(mine.staff.email);
    const staffPage = await staff.send("/provider");
    expect(staffPage.body).not.toContain(`Synthetic enquiry for mine ${TAG}`);
  });
});

describe("admin demand and support (A13: aal2 only)", () => {
  it("every new admin route is 404 to non-admins and sends aal1 admins to MFA", async () => {
    for (const path of ADMIN_PATHS) {
      expect((await stranger.send(path)).status).toBe(404);
      const step = await adminAal1.send(path);
      expect(step.status).toBe(302);
      expect(step.location).toMatch(/^\/auth\/mfa\?returnTo=/);
    }
    expect((await new Browser().send("/admin/demand")).status).toBe(302);
  });

  it("an aal2 admin reads demand and withdraws one; aal1 can't post", async () => {
    const address = `demand-${TAG}-${randomUUID().slice(0, 6)}@example.test`;
    const id = demandFixture(address);
    const page = await admin.send("/admin/demand");
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.body).toContain(address);
    expect(page.body).toContain("Limpopo");

    await adminAal1.send("/admin");
    const blocked = await adminAal1.send("/admin/demand", { form: { id } });
    expect(blocked.status).toBe(302);
    expect(
      sqlRows(`select count(*) from public.demand_requests where id = '${id}'`),
    ).toEqual(["1"]);

    const done = await admin.send("/admin/demand", { form: { id } });
    expect(done.status).toBe(302);
    expect(done.location).toBe("/admin/demand?withdrawn=1");
    expect(
      sqlRows(`select count(*) from public.demand_requests where id = '${id}'`),
    ).toEqual(["0"]);
    expect(
      sqlRows(
        `select count(*) from public.consents where subject_email = '${address}' and withdrawn_at is not null`,
      ),
    ).toEqual(["1"]);
    expect((await admin.send("/admin/demand")).body).not.toContain(address);
  });

  it("demand never shows on a provider or public page", async () => {
    const address = `demand-hidden-${TAG}@example.test`;
    demandFixture(address);
    const mine = await provider("demand-hidden");
    const owner = await signIn(mine.owner.email);
    for (const path of ["/provider", `/p/${mine.listing}`, "/"])
      expect((await owner.send(path)).body).not.toContain(address);
  });

  it("an aal2 admin reads and closes a support case", async () => {
    const address = `support-${TAG}@example.test`;
    const id = supportFixture(address);
    const list = await admin.send("/admin/support");
    expect(list.body).toContain(`/admin/support/${id}`);
    const detail = await admin.send(`/admin/support/${id}`);
    expect(detail.body).toContain(`Synthetic support case ${TAG}`);
    expect(detail.body).toContain('data-case-status="open"');
    const short = await admin.send(`/admin/support/${id}`, {
      form: { note: "no" },
    });
    expect(short.status).toBe(400);
    const closed = await admin.send(`/admin/support/${id}`, {
      form: { note: "Synthetic: replied by email." },
    });
    expect(closed.status).toBe(302);
    expect((await admin.send(`/admin/support/${id}`)).body).toContain(
      'data-case-status="closed"',
    );
    const again = await admin.send(`/admin/support/${id}`, {
      form: { note: "Synthetic: second close." },
    });
    expect(again.status).toBe(400);
    expect(again.body).toContain('data-problem="case_not_open"');
  });
});

describe("A14: no ID-number field anywhere; fines copy", () => {
  // Any form control whose name, id, autocomplete or nearby label suggests an
  // ID, licence or registration number, or that takes exactly 13 digits.
  const SUSPECT =
    /<(?:input|select|textarea)\b[^>]*(?:(?:name|id|autocomplete|aria-label|placeholder)="[^"]*(?:id[_-]?n(?:o|um)|identity|sa-?id|licen[cs]e|registration|\bvin\b)[^"]*"|pattern="[^"]*13[^"]*"|maxlength="13"|minlength="13")/i;
  const LABEL =
    /<label\b[^>]*>[^<]*(?:ID number|identity number|licence number|registration number)/i;

  it("no page a visitor or provider can open has such a field", async () => {
    const owner = await signIn((await createConfirmedUser("p26-scan")).email);
    const anon = new Browser();
    const pages = [
      [anon, "/"],
      [anon, "/fines"],
      [anon, "/support"],
      [anon, "/demand"],
      [anon, "/p/ca7c1000-0000-4000-8000-000000000001"],
      [anon, "/c/wash-and-detailing"],
      [anon, "/auth/sign-up"],
      [anon, "/auth/sign-in"],
      [owner, "/provider"],
      [owner, "/provider/apply"],
      [owner, "/account"],
    ] as const;
    for (const [browser, path] of pages) {
      const reply = await browser.send(path);
      expect(reply.status, path).toBeLessThan(500);
      expect(SUSPECT.test(reply.body), path).toBe(false);
      expect(LABEL.test(reply.body), path).toBe(false);
    }
  });

  it("the scan does catch an ID field (self-check)", () => {
    expect(SUSPECT.test('<input name="id_number" />')).toBe(true);
    expect(SUSPECT.test('<input name="x" maxlength="13" />')).toBe(true);
    expect(LABEL.test("<label for=x>Your ID number</label>")).toBe(true);
  });

  it("/fines has no field, no lookup, the no-results warning and official links only", async () => {
    const reply = await new Browser().send("/fines");
    expect(reply.status).toBe(200);
    expect(reply.body).not.toMatch(/<(?:form|input|select|textarea)\b/i);
    expect(reply.body).toContain("doesn&#x27;t always mean you have none");
    const external = [...reply.body.matchAll(/href="(https?:\/\/[^"]+)"/g)]
      .map((m) => m[1])
      .filter((h) => h !== undefined && !h.startsWith("http://localhost"));
    expect(external).toEqual(["https://www.rtia.co.za/"]);
  });
});
