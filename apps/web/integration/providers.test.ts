import { describe, expect, it } from "vitest";

import {
  attr,
  Browser,
  createConfirmedUser,
  signIn,
  sql,
  sqlRows,
} from "./harness";

// P2-4 (Claude 21): provider pages through the built Worker and the local
// stack. Admin decisions here are applied as the database owner; the admin
// routes, at aal2, are tested with them in the admin PR. SYNTHETIC DATA ONLY.
// Integration tests import no app files (tsconfig.node), so the service
// slugs below are the seed's.

const fixed = {
  businessName: "Integration Motors (synthetic)",
  service: "service",
  mode: "fixed",
  metro: "Gauteng",
  description: "Synthetic workshop for integration tests",
  address: "9 Synthetic Lane, Exampleville",
  latitude: "-26.1001",
  longitude: "28.0402",
  confirm: "on",
};

async function apply(browser: Browser, form: Record<string, string>) {
  await browser.send("/provider/apply");
  return browser.send("/provider/apply", { form });
}

function listingIds(body: string): string[] {
  return [...body.matchAll(/data-listing="([0-9a-f-]{36})"/g)].map(
    (m) => m[1] ?? "",
  );
}

function setLive(publicId: string) {
  if (!/^[0-9a-f-]{36}$/.test(publicId)) throw new Error("bad id");
  sql(
    `update public.listings set status = 'live' where public_id = '${publicId}'`,
  );
}

describe("provider applications", () => {
  it("needs a signed-in person", async () => {
    const anon = new Browser();
    for (const path of [
      "/provider",
      "/provider/apply",
      "/provider/claim/0b0b5f4e-2f8c-4b55-9a52-6a5f3c7d1e20",
    ]) {
      const reply = await anon.send(path);
      expect(reply.status).toBe(302);
      // Sign-in brings the person back to the page they asked for.
      expect(reply.location).toBe(
        `/auth/sign-in?returnTo=${encodeURIComponent(path)}`,
      );
    }
  });

  it("the account page links to the provider dashboard and application", async () => {
    const user = await createConfirmedUser("provider-entry");
    const browser = await signIn(user.email);
    const page = await browser.send("/account");
    expect(page.status).toBe(200);
    expect(page.body).toContain('href="/provider"');
    expect(page.body).toContain('href="/provider/apply"');
  });

  it("every service offered on the form exists in the catalogue", () => {
    const slugs = new Set(sqlRows("select slug from public.services"));
    for (const slug of [
      "wash",
      "service",
      "paint",
      "electrical",
      "mobile-repair",
      "glass",
      "tyres",
    ])
      expect(slugs.has(slug)).toBe(true);
  });

  it("apply → submitted (private, no-store) → one at a time → live after review", async () => {
    const user = await createConfirmedUser("applicant");
    const browser = await signIn(user.email);

    const bad = await apply(browser, { ...fixed, latitude: "51.5" });
    expect(bad.status).toBe(400);
    expect(bad.body).toContain('data-problem="invalid_input"');

    const sent = await apply(browser, fixed);
    expect(sent.status).toBe(302);
    expect(sent.location).toBe("/provider?applied=1");

    const page = await browser.send("/provider?applied=1");
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toMatch(/no-store/);
    expect(page.body).toContain('data-notice="applied"');
    expect(page.body).toContain('data-status="submitted"');
    const [publicId = ""] = listingIds(page.body);

    const again = await apply(browser, {
      ...fixed,
      businessName: "Second (synthetic)",
    });
    expect(again.status).toBe(400);
    expect(again.body).toContain('data-problem="application_pending"');

    expect((await new Browser().send(`/p/${publicId}`)).status).toBe(404);
    setLive(publicId);
    const listing = await new Browser().send(`/p/${publicId}`);
    expect(listing.status).toBe(200);
    expect(listing.body).toContain("Integration Motors (synthetic)");
    expect(listing.body).toContain(`/provider/claim/${publicId}`);
  });

  it("never renders a mobile base or radius, even to its owner (A10)", async () => {
    const user = await createConfirmedUser("mobile");
    const browser = await signIn(user.email);
    const sent = await apply(browser, {
      ...fixed,
      businessName: "Integration Mobile (synthetic)",
      service: "mobile-repair",
      mode: "mobile",
      address: "",
      latitude: "-26.0517",
      longitude: "28.0389",
      radiusKm: "37",
    });
    expect(sent.status).toBe(302);
    const page = await browser.send("/provider");
    expect(page.body).toContain("Your base and distance stay private");
    for (const secret of [
      "-26.0517",
      "28.0389",
      "26.05",
      "28.03",
      "37 km",
      '"37"',
    ])
      expect(page.body).not.toContain(secret);
  });

  it("rejected → owner sees the reason and resubmits", async () => {
    const user = await createConfirmedUser("resubmit");
    const browser = await signIn(user.email);
    await apply(browser, {
      ...fixed,
      businessName: "Resubmit Motors (synthetic)",
    });
    const [publicId = ""] = listingIds((await browser.send("/provider")).body);
    sql(`update public.listings set status = 'draft' where public_id = '${publicId}';
      insert into public.listing_decisions(listing_public_id, organisation_id, decision, reason, decided_by)
      select public_id, organisation_id, 'rejected', 'Synthetic: add your opening hours', '${user.id}'
      from public.listings where public_id = '${publicId}'`);
    const page = await browser.send("/provider");
    expect(page.body).toContain("Synthetic: add your opening hours");
    const sent = await browser.send("/provider", {
      form: {
        intent: "resubmit",
        listing: publicId,
        displayName: "Resubmit Motors (synthetic)",
        description: "Synthetic workshop, open weekdays 8 to 5",
      },
    });
    expect(sent.status).toBe(302);
    expect((await browser.send("/provider")).body).toContain(
      'data-status="submitted"',
    );
  });
});

describe("claims, disputes and former staff", () => {
  it("claim → the controlling owner disputes it; nothing transfers", async () => {
    const owner = await createConfirmedUser("claim-owner");
    const ownerBrowser = await signIn(owner.email);
    await apply(ownerBrowser, {
      ...fixed,
      businessName: "Claimed Motors (synthetic)",
    });
    const [publicId = ""] = listingIds(
      (await ownerBrowser.send("/provider")).body,
    );
    setLive(publicId);

    const claimant = await createConfirmedUser("claimant");
    const claimBrowser = await signIn(claimant.email);
    const form = await claimBrowser.send(`/provider/claim/${publicId}`);
    expect(form.status).toBe(200);
    expect(form.body).toContain("example.test");
    const noRef = await claimBrowser.send(`/provider/claim/${publicId}`, {
      form: { evidence: "document" },
    });
    expect(noRef.body).toContain('data-problem="invalid_input"');
    const claimed = await claimBrowser.send(`/provider/claim/${publicId}`, {
      form: { evidence: "business_email" },
    });
    expect(claimed.status).toBe(302);
    expect(claimed.location).toBe("/provider?claimed=1");
    const mine = await claimBrowser.send("/provider");
    expect(mine.body).toContain('data-claim-status="submitted"');

    // The owner can't claim their own listing.
    const own = await ownerBrowser.send(`/provider/claim/${publicId}`, {
      form: { evidence: "business_email" },
    });
    expect(own.body).toContain('data-problem="already_member"');

    const ownerPage = await ownerBrowser.send("/provider");
    const claimId = attr(ownerPage.body, "data-claim") ?? "";
    expect(claimId).toMatch(/^[0-9a-f-]{36}$/);
    const disputed = await ownerBrowser.send("/provider", {
      form: {
        intent: "dispute",
        claim: claimId,
        reason: "Synthetic: I run this workshop",
      },
    });
    expect(disputed.status).toBe(302);
    expect((await ownerBrowser.send("/provider")).body).toContain(
      'data-claim-status="disputed"',
    );
    // Control has not moved.
    expect(
      sqlRows(`select m.role from public.memberships m join public.listings l on l.organisation_id = m.organisation_id
        where l.public_id = '${publicId}' and m.status = 'active'`),
    ).toEqual(["owner"]);
  });

  it("claim history never hides a claim that can still be disputed", async () => {
    const owner = await createConfirmedUser("history-owner");
    const ownerBrowser = await signIn(owner.email);
    await apply(ownerBrowser, {
      ...fixed,
      businessName: "History Motors (synthetic)",
    });
    const [publicId = ""] = listingIds(
      (await ownerBrowser.send("/provider")).body,
    );
    setLive(publicId);
    // One older pending claim, then 55 newer rejected ones by other people.
    const pending = sqlRows(`
      with u as (insert into auth.users(id, email, email_confirmed_at)
        values (gen_random_uuid(), 'history-pending-' || substr(md5(random()::text), 1, 8) || '@example.test', now()) returning id)
      insert into public.listing_claims(listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference, created_at)
      select l.public_id, l.organisation_id, u.id, 'document', 'Synthetic older ref', now() - interval '1 day'
      from public.listings l, u where l.public_id = '${publicId}' returning id`)[0];
    sqlRows(`
      with u as (insert into auth.users(id, email, email_confirmed_at)
        select gen_random_uuid(), 'history-' || g || '-' || substr(md5(random()::text), 1, 8) || '@example.test', now()
        from generate_series(1, 55) g returning id)
      insert into public.listing_claims(listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference, status, review_note)
      select l.public_id, l.organisation_id, u.id, 'document', 'Synthetic newer ref', 'rejected', 'Synthetic: not the owner'
      from public.listings l, u where l.public_id = '${publicId}' returning id`);
    const page = await ownerBrowser.send("/provider");
    expect(page.body).toContain(`data-claim="${pending ?? ""}"`);
    expect(page.body).toContain("Dispute this claim");
    expect(page.body).not.toContain('data-claim-status="rejected"');
  });

  it("an owner revokes former staff; access ends on their next request", async () => {
    const owner = await createConfirmedUser("staff-owner");
    const ownerBrowser = await signIn(owner.email);
    await apply(ownerBrowser, {
      ...fixed,
      businessName: "Staffed Motors (synthetic)",
    });
    const [publicId = ""] = listingIds(
      (await ownerBrowser.send("/provider")).body,
    );
    const staff = await createConfirmedUser("staff");
    sql(`insert into public.memberships(organisation_id, user_id, role, status)
      select organisation_id, '${staff.id}', 'staff', 'active' from public.listings where public_id = '${publicId}'`);
    const staffBrowser = await signIn(staff.email);
    expect(listingIds((await staffBrowser.send("/provider")).body)).toContain(
      publicId,
    );

    const ownerPage = await ownerBrowser.send("/provider");
    const members = [
      ...ownerPage.body.matchAll(/data-member="([0-9a-f-]{36})"/g),
    ].map((m) => m[1] ?? "");
    expect(members).toHaveLength(2);
    const staffMembership = sqlRows(
      `select id from public.memberships where user_id = '${staff.id}'`,
    )[0];
    expect(members).toContain(staffMembership);

    // Staff can't revoke anyone; the owner can.
    const denied = await staffBrowser.send("/provider", {
      form: {
        intent: "revoke",
        membership: members.find((m) => m !== staffMembership) ?? "",
      },
    });
    expect(denied.body).toContain('data-problem="not_allowed"');
    const revoked = await ownerBrowser.send("/provider", {
      form: { intent: "revoke", membership: staffMembership ?? "" },
    });
    expect(revoked.status).toBe(302);
    expect(
      listingIds((await staffBrowser.send("/provider")).body),
    ).not.toContain(publicId);
  });

  it("refuses a cross-site post", async () => {
    const user = await createConfirmedUser("csrf");
    const browser = await signIn(user.email);
    await browser.send("/provider/apply");
    const reply = await browser.send("/provider/apply", {
      form: fixed,
      origin: "https://evil.example",
    });
    expect(reply.status).toBe(403);
  });
});
