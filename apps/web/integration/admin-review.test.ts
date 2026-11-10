import { beforeAll, describe, expect, it } from "vitest";

import {
  asUser,
  attr,
  Browser,
  createConfirmedUser,
  makePlatformAdmin,
  signIn,
  sqlRows,
  totp,
} from "./harness";

// P2-7 (Claude 21): admin review, suspension, claims, disputes, revocation
// and the audit view, through the built Worker with a real TOTP step-up.
// Every admin route is 404 to non-admins and redirects aal1 admins to
// /auth/mfa; the database refuses aal1 too. SYNTHETIC DATA ONLY.

const ADMIN_PATHS = [
  "/admin/listings",
  "/admin/listings?status=live",
  "/admin/claims",
  "/admin/listings/ca7c1000-0000-4000-8000-000000000001",
];

const fixed = {
  businessName: "Review Motors (synthetic)",
  service: "service",
  mode: "fixed",
  metro: "Gauteng",
  description: "Synthetic workshop waiting for review",
  address: "3 Synthetic Close, Exampleville",
  latitude: "-26.1501",
  longitude: "28.0101",
  confirm: "on",
};

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

async function applyAs(label: string, form: Record<string, string>) {
  const user = await createConfirmedUser(label);
  const browser = await signIn(user.email);
  await browser.send("/provider/apply");
  const sent = await browser.send("/provider/apply", { form });
  expect(sent.status).toBe(302);
  const page = await browser.send("/provider");
  const publicId = /data-listing="([0-9a-f-]{36})"/.exec(page.body)?.[1] ?? "";
  return { user, browser, publicId };
}

let admin: Browser;
let adminAal1: Browser;

beforeAll(async () => {
  const a = await createConfirmedUser("p27-admin");
  makePlatformAdmin(a.id);
  admin = await signIn(a.email);
  await stepUp(admin);
  const b = await createConfirmedUser("p27-admin-aal1");
  makePlatformAdmin(b.id);
  adminAal1 = await signIn(b.email);
});

describe("every admin route needs a listed admin at aal2", () => {
  it("is 404 for a signed-in non-admin, GET and POST", async () => {
    const user = await createConfirmedUser("p27-not-admin");
    const browser = await signIn(user.email);
    for (const path of ADMIN_PATHS) {
      expect((await browser.send(path)).status).toBe(404);
    }
    const post = await browser.send(
      "/admin/listings/ca7c1000-0000-4000-8000-000000000001",
      { form: { intent: "suspend", reason: "Synthetic attempt" } },
    );
    expect(post.status).toBe(404);
  });

  it("sends an aal1 admin to /auth/mfa before reading anything", async () => {
    for (const path of ADMIN_PATHS) {
      const reply = await adminAal1.send(path);
      expect(reply.status).toBe(302);
      expect(reply.location).toMatch(/^\/auth\/mfa\?returnTo=%2Fadmin/);
    }
    const post = await adminAal1.send(
      "/admin/listings/ca7c1000-0000-4000-8000-000000000001",
      { form: { intent: "suspend", reason: "Synthetic attempt" } },
    );
    expect(post.status).toBe(302);
    expect(
      sqlRows(
        "select status from public.listings where public_id = 'ca7c1000-0000-4000-8000-000000000001'",
      ),
    ).toEqual(["live"]);
  });

  it("refuses an aal1 admin token at the database API too", async () => {
    const db = asUser(adminAal1.session().access_token);
    const { error } = await db.rpc("admin_set_suspension", {
      p_listing: "ca7c1000-0000-4000-8000-000000000001",
      p_suspend: true,
      p_reason: "Synthetic attempt",
    });
    expect(error?.code).toBe("42501");
    const decisions = await db.from("listing_decisions").select("id");
    expect(decisions.data).toEqual([]);
  });
});

describe("review queue", () => {
  it("application → approval with method and labels → live (A12)", async () => {
    const { publicId } = await applyAs("p27-fixed", fixed);
    const queue = await admin.send("/admin/listings?status=submitted");
    expect(queue.status).toBe(200);
    expect(queue.headers.get("Cache-Control")).toMatch(/no-store/);
    expect(queue.body).toContain(`data-row="${publicId}"`);

    const noMethod = await admin.send(`/admin/listings/${publicId}`, {
      form: {
        intent: "decide",
        decision: "approve",
        labels: "identity_checked",
      },
    });
    expect(noMethod.body).toContain('data-problem="invalid_input"');

    const approved = await admin.send(`/admin/listings/${publicId}`, {
      form: {
        intent: "decide",
        decision: "approve",
        method: "site_visit",
        labels: ["identity_checked", "premises_visited"],
        evidence: "synthetic-visit-note-1",
      },
    });
    expect(approved.status).toBe(302);
    const listing = await new Browser().send(`/p/${publicId}`);
    expect(listing.status).toBe(200);
    expect(listing.body).toContain("Identity checked");
    expect(listing.body).toContain("Premises visited");

    const detail = await admin.send(`/admin/listings/${publicId}`);
    expect(detail.body).toContain('data-listing-status="live"');
    expect(detail.body).toContain('data-decision="approved"');
  });

  it("never shows a mobile base or radius to the admin (A10)", async () => {
    const { publicId } = await applyAs("p27-mobile", {
      ...fixed,
      businessName: "Review Mobile (synthetic)",
      service: "mobile-repair",
      mode: "mobile",
      address: "",
      latitude: "-26.0731",
      longitude: "28.1173",
      radiusKm: "43",
    });
    const detail = await admin.send(`/admin/listings/${publicId}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toContain("service area kept private");
    expect(detail.body).not.toMatch(/premises_visited/);
    for (const secret of ["-26.0731", "28.1173", "26.07", "28.11", "43 km"])
      expect(detail.body).not.toContain(secret);

    const rejected = await admin.send(`/admin/listings/${publicId}`, {
      form: {
        intent: "decide",
        decision: "reject",
        reason: "Synthetic: add a phone number",
      },
    });
    expect(rejected.status).toBe(302);
    expect((await admin.send(`/admin/listings/${publicId}`)).body).toContain(
      'data-listing-status="draft"',
    );
  });

  it("suspension hides a live listing; reinstatement brings it back (A12)", async () => {
    const { publicId } = await applyAs("p27-suspend", {
      ...fixed,
      businessName: "Suspend Motors (synthetic)",
    });
    expect(
      (
        await admin.send(`/admin/listings/${publicId}`, {
          form: { intent: "decide", decision: "approve", method: "phone_call" },
        })
      ).status,
    ).toBe(302);
    const suspended = await admin.send(`/admin/listings/${publicId}`, {
      form: { intent: "suspend", reason: "Synthetic: complaint under review" },
    });
    expect(suspended.status).toBe(302);
    expect((await new Browser().send(`/p/${publicId}`)).status).toBe(404);
    expect(
      (await admin.send("/admin/listings?status=suspended")).body,
    ).toContain(publicId);
    const back = await admin.send(`/admin/listings/${publicId}`, {
      form: { intent: "reinstate", reason: "Synthetic: complaint resolved" },
    });
    expect(back.status).toBe(302);
    expect((await new Browser().send(`/p/${publicId}`)).status).toBe(200);
  });
});

describe("paging", () => {
  it("reaches every listing beyond the first 50", async () => {
    const org = sqlRows(
      "insert into public.organisations(name) values ('Paging Org (synthetic)') returning id",
    )[0];
    const ids =
      sqlRows(`insert into public.listings(organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
      select '${org ?? ""}', 'mobile-repair', 'Paging ' || g, 'Synthetic paging fixture', 'Gauteng', 'mobile', 'suspended', 'admin_import', 'synthetic-paging'
      from generate_series(1, 55) g returning public_id`);
    expect(ids).toHaveLength(55);
    const seen = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const reply = await admin.send(
        `/admin/listings?status=suspended&page=${String(page)}`,
      );
      expect(reply.status).toBe(200);
      for (const m of reply.body.matchAll(/data-row="([0-9a-f-]{36})"/g))
        seen.add(m[1] ?? "");
      if (!reply.body.includes("data-next")) break;
    }
    for (const id of ids) expect(seen.has(id)).toBe(true);
    expect(
      (await admin.send("/admin/listings?status=live&page=0")).status,
    ).toBe(404);
    expect((await admin.send("/admin/claims?page=x")).status).toBe(404);
  });
});

describe("claims", () => {
  it("a disputed claim is upheld; a later claim transfers control and is reversed (A12)", async () => {
    const owner = await applyAs("p27-claim-owner", {
      ...fixed,
      businessName: "Contested Motors (synthetic)",
    });
    await admin.send(`/admin/listings/${owner.publicId}`, {
      form: { intent: "decide", decision: "approve", method: "phone_call" },
    });

    // Claim 1, disputed by the owner, upheld by the admin.
    const c1 = await createConfirmedUser("p27-claimant-1");
    const c1b = await signIn(c1.email);
    await c1b.send(`/provider/claim/${owner.publicId}`);
    await c1b.send(`/provider/claim/${owner.publicId}`, {
      form: {
        evidence: "document",
        documentReference: "Synthetic lease ref 1",
      },
    });
    const ownerPage = await owner.browser.send("/provider");
    const claim1 = attr(ownerPage.body, "data-claim") ?? "";
    await owner.browser.send("/provider", {
      form: {
        intent: "dispute",
        claim: claim1,
        reason: "Synthetic: I run this workshop",
      },
    });
    const list = await admin.send("/admin/claims");
    expect(list.body).toContain(`data-row="${claim1}"`);
    const detail = await admin.send(`/admin/claims/${claim1}`);
    expect(detail.body).toContain('data-claim-status="disputed"');
    const dispute = attr(detail.body, "data-dispute") ?? "";
    expect(
      (
        await admin.send(`/admin/claims/${claim1}`, {
          form: {
            intent: "uphold",
            dispute,
            note: "Synthetic: owner evidence stronger",
          },
        })
      ).status,
    ).toBe(302);
    expect((await admin.send(`/admin/claims/${claim1}`)).body).toContain(
      'data-claim-status="rejected"',
    );

    // Claim 2: approved, so control transfers; the old owner loses access.
    const c2 = await createConfirmedUser("p27-claimant-2");
    const c2b = await signIn(c2.email);
    await c2b.send(`/provider/claim/${owner.publicId}`);
    await c2b.send(`/provider/claim/${owner.publicId}`, {
      form: { evidence: "business_email" },
    });
    const claim2 =
      sqlRows(
        `select id from public.listing_claims where claimant_id = '${c2.id}'`,
      )[0] ?? "";
    expect(
      (
        await admin.send(`/admin/claims/${claim2}`, {
          form: { intent: "approve", method: "registry_check", note: "" },
        })
      ).status,
    ).toBe(302);
    expect((await c2b.send("/provider")).body).toContain(owner.publicId);
    const displaced = await owner.browser.send("/provider");
    expect(displaced.body).not.toContain(`data-listing="${owner.publicId}"`);
    expect(displaced.body).toContain(`data-claim="${claim2}"`);

    // The displaced owner disputes; upholding reverses the transfer.
    await owner.browser.send("/provider", {
      form: {
        intent: "dispute",
        claim: claim2,
        reason: "Synthetic: transfer was wrong",
      },
    });
    const d2 =
      attr(
        (await admin.send(`/admin/claims/${claim2}`)).body,
        "data-dispute",
      ) ?? "";
    await admin.send(`/admin/claims/${claim2}`, {
      form: {
        intent: "uphold",
        dispute: d2,
        note: "Synthetic: transfer reversed",
      },
    });
    expect((await admin.send(`/admin/claims/${claim2}`)).body).toContain(
      'data-claim-status="reversed"',
    );
    expect((await owner.browser.send("/provider")).body).toContain(
      `data-listing="${owner.publicId}"`,
    );
    expect((await c2b.send("/provider")).body).not.toContain(
      `data-listing="${owner.publicId}"`,
    );
  });

  it("an admin removes a former staff member from the listing page", async () => {
    const owner = await applyAs("p27-staff-owner", {
      ...fixed,
      businessName: "Staff Review Motors (synthetic)",
    });
    const staff = await createConfirmedUser("p27-staff");
    sqlRows(`insert into public.memberships(organisation_id, user_id, role, status)
      select organisation_id, '${staff.id}', 'staff', 'active' from public.listings where public_id = '${owner.publicId}'`);
    const membership =
      sqlRows(
        `select id from public.memberships where user_id = '${staff.id}'`,
      )[0] ?? "";
    const removed = await admin.send(`/admin/listings/${owner.publicId}`, {
      form: { intent: "revoke", membership },
    });
    expect(removed.status).toBe(302);
    expect(
      sqlRows(
        `select status from public.memberships where id = '${membership}'`,
      ),
    ).toEqual(["revoked"]);
  });
});
