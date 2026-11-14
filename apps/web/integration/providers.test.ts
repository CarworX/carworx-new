import { describe, expect, it, onTestFinished } from "vitest";

import { apply } from "./onboarding";

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

  it("resumes a saved both-mode draft and requires the final acknowledgements", async () => {
    const user = await createConfirmedUser("onboarding-resume");
    const browser = await signIn(user.email);
    const premature = await browser.send("/provider/get-listed/check");
    expect(premature.location).toBe("/provider/get-listed/business");
    await browser.send("/provider/get-listed/business");
    expect(
      (
        await browser.send("/provider/get-listed/business", {
          form: {
            intent: "save",
            businessName: "Resumed Motors (synthetic)",
            role: "manager",
          },
        })
      ).location,
    ).toBe("/provider/get-listed/service");
    const resumed = await signIn(user.email);
    const servicePage = await resumed.send("/provider/get-listed/service");
    expect(servicePage.status).toBe(200);
    expect(servicePage.body).toContain("Resumed Motors (synthetic)");
    expect(
      (
        await resumed.send("/provider/get-listed/service", {
          form: {
            intent: "save",
            services: ["wash", "service"],
            work: ["fixed", "mobile"],
            team: "2-5",
          },
        })
      ).location,
    ).toBe("/provider/get-listed/location");
    await resumed.send("/provider/get-listed/location");
    // The submitted mode is deliberately wrong: the saved draft remains authoritative.
    expect(
      (
        await resumed.send("/provider/get-listed/location", {
          form: {
            intent: "save",
            mode: "mobile",
            metro: "Johannesburg",
            address: "12 Synthetic Street",
            pinLat: "-26.204100123456789",
            pinLng: "28.047300123456789",
            pinSource: "device",
            radiusKm: "25",
          },
        })
      ).location,
    ).toBe("/provider/get-listed/about");
    expect(
      sqlRows(
        `select mode || '|' || public_address from public.provider_applications where user_id = '${user.id}' and submitted_at is null`,
      ),
    ).toEqual(["both|12 Synthetic Street"]);
    await resumed.send("/provider/get-listed/about");
    expect(
      (
        await resumed.send("/provider/get-listed/about", {
          form: {
            intent: "save",
            description: "Synthetic resumed business",
            "open-1": "on",
            "opens-1": "08:00",
            "closes-1": "17:00",
            "open-5": "on",
            "opens-5": "08:00",
            "closes-5": "17:00",
          },
        })
      ).location,
    ).toBe("/provider/get-listed/check");
    await resumed.send("/provider/get-listed/check");
    expect(
      (
        await resumed.send("/provider/get-listed/check", {
          form: { intent: "submit", probing: "on" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await resumed.send("/provider/get-listed/check", {
          form: { intent: "submit", adult: "on" },
        })
      ).status,
    ).toBe(400);
    expect(
      sqlRows(
        `select count(*) from public.listings l join public.memberships m on m.organisation_id = l.organisation_id where m.user_id = '${user.id}'`,
      ),
    ).toEqual(["0"]);
    const sent = await resumed.send("/provider/get-listed/check", {
      form: { intent: "submit", adult: "on", probing: "on" },
    });
    expect(sent.location).toBe("/provider/get-listed/submitted");
    expect(
      sqlRows(
        `select (adult_attested_at is not null and probing_notice_ack_at is not null)::text from public.provider_applications where user_id = '${user.id}' and submitted_at is not null`,
      ),
    ).toEqual(["true"]);
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
    expect(bad.body).toContain("Check your answers");

    const sent = await apply(browser, fixed);
    expect(sent.status).toBe(302);
    expect(sent.location).toBe("/provider/get-listed/submitted");

    const submitted = await browser.send("/provider/get-listed/submitted");
    expect(submitted.body).toContain("Application sent");
    const page = await browser.send("/provider");
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toMatch(/no-store/);
    expect(page.body).toContain('data-status="submitted"');
    const [publicId = ""] = listingIds(page.body);

    const again = await apply(browser, {
      ...fixed,
      businessName: "Second (synthetic)",
    });
    expect(again.status).toBe(400);
    expect(again.body).toContain("already waiting for review");

    expect((await new Browser().send(`/p/${publicId}`)).status).toBe(404);
    setLive(publicId);
    const listing = await new Browser().send(`/p/${publicId}`);
    expect(listing.status).toBe(200);
    expect(listing.body).toContain("Integration Motors (synthetic)");
    expect(listing.body).toContain(`/provider/claim/${publicId}`);
  });

  it("a multi-line description is accepted and keeps its line break", async () => {
    const user = await createConfirmedUser("multiline");
    const browser = await signIn(user.email);
    const sent = await apply(browser, {
      ...fixed,
      businessName: "Multiline Motors (synthetic)",
      description: "Synthetic workshop\r\nOpen on weekdays",
    });
    expect(sent.status).toBe(302);
    const [row] = sqlRows(
      `select replace(replace(l.description, chr(13), '<CR>'), chr(10), '<LF>') from public.listings l join public.memberships m on m.organisation_id = l.organisation_id
       where m.user_id = '${user.id}'`,
    );
    expect(row).toBe("Synthetic workshop<LF>Open on weekdays");
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
    const proof = await claimBrowser.send(
      `/provider/claim/${publicId}?step=proof`,
    );
    expect(proof.status).toBe(200);
    expect(proof.body).not.toContain('type="text"');
    expect(proof.body).not.toContain("<textarea");
    const docReview = await claimBrowser.send(`/provider/claim/${publicId}`, {
      form: {
        intent: "review",
        evidence: "document",
        documentType: "utility",
        documentYear: "2020",
        documentMonth: "10",
        documentDay: "31",
      },
    });
    expect(docReview.status).toBe(200);
    expect(docReview.body).toContain("Utility bill");
    expect(docReview.body).toContain("2020-10-31");
    const review = await claimBrowser.send(`/provider/claim/${publicId}`, {
      form: { intent: "review", evidence: "business_email" },
    });
    expect(review.status).toBe(200);
    expect(review.body).toContain("Is this right?");
    expect(
      sqlRows(
        `select count(*) from public.listing_claims where claimant_id = '${claimant.id}'`,
      ),
    ).toEqual(["0"]);
    const claimed = await claimBrowser.send(`/provider/claim/${publicId}`, {
      form: { intent: "submit", evidence: "business_email" },
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

  it("claims are paged past the server's row cap: each once, ties kept, disputes still reachable", async () => {
    const owner = await createConfirmedUser("paged-owner");
    const ownerBrowser = await signIn(owner.email);
    await apply(ownerBrowser, {
      ...fixed,
      businessName: "Paged Motors (synthetic)",
    });
    const [publicId = ""] = listingIds(
      (await ownerBrowser.send("/provider")).body,
    );
    setLive(publicId);
    // 1,105 pending claims on the owner's business (more than PostgREST's
    // max_rows of 1,000); 300 of them share one created_at to test ties.
    const pending = sqlRows(`
      with u as (insert into auth.users(id, email, email_confirmed_at)
        select gen_random_uuid(), 'paged-' || g || '-' || substr(md5(random()::text), 1, 8) || '@example.test', now()
        from generate_series(1, 1105) g returning id),
      n as (select id, row_number() over () as g from u)
      insert into public.listing_claims(listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference, created_at)
      select l.public_id, l.organisation_id, n.id, 'document', 'Synthetic paged ref',
        case when n.g <= 300 then timestamptz '2026-01-01 12:00:00.123456+00' else now() - n.g * interval '1 minute' end
      from public.listings l, n where l.public_id = '${publicId}' returning id`);
    // Shared local stack: remove the bulk rows afterwards so other suites'
    // first pages (the admin claims queue) are not filled with them.
    onTestFinished(() => {
      sql(
        `delete from public.listing_claims where document_reference in ('Synthetic paged ref', 'Synthetic taker ref', 'Synthetic stranger ref')`,
      );
    });
    expect(pending).toHaveLength(1105);
    // The oldest of all: a transfer that displaced this owner from another
    // business. It is still disputable and sits far beyond the first page.
    const [displaced = ""] = sqlRows(`
      with o as (insert into public.organisations(name) values ('Paged Other Motors (synthetic)') returning id),
      c as (insert into auth.users(id, email, email_confirmed_at)
        values (gen_random_uuid(), 'paged-taker-' || substr(md5(random()::text), 1, 8) || '@example.test', now()) returning id),
      l as (insert into public.listings(organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
        select o.id, s.slug, 'Paged other listing (synthetic)', 'Synthetic other listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-paged-other'
        from o, (select slug from public.services order by slug limit 1) s returning public_id, organisation_id),
      m as (insert into public.memberships(organisation_id, user_id, role, status)
        select o.id, c.id, 'owner', 'active' from o, c union all select o.id, '${owner.id}', 'owner', 'revoked' from o returning id)
      insert into public.listing_claims(listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference, status, review_method,
          decided_at, approved_at, displaced_user_ids, displaced_roles, created_at)
      select l.public_id, l.organisation_id, c.id, 'document', 'Synthetic taker ref', 'approved', 'document_check',
        now(), clock_timestamp(), array['${owner.id}'::uuid], array['owner'], timestamptz '2025-01-01 00:00:00+00'
      from l, c returning id`);
    // Another tenant's claim: never shown to this owner.
    const [other = ""] = sqlRows(`
      with o as (insert into public.organisations(name) values ('Paged Stranger Motors (synthetic)') returning id),
      c as (insert into auth.users(id, email, email_confirmed_at)
        values (gen_random_uuid(), 'paged-stranger-' || substr(md5(random()::text), 1, 8) || '@example.test', now()) returning id),
      l as (insert into public.listings(organisation_id, service_slug, display_name, description, metro, mode, status, provenance_kind, provenance_reference)
        select o.id, s.slug, 'Paged stranger listing (synthetic)', 'Synthetic stranger listing', 'Gauteng', 'mobile', 'live', 'admin_import', 'synthetic-paged-stranger'
        from o, (select slug from public.services order by slug limit 1) s returning public_id, organisation_id)
      insert into public.listing_claims(listing_public_id, organisation_id, claimant_id, evidence_kind, document_reference)
      select l.public_id, l.organisation_id, c.id, 'document', 'Synthetic stranger ref' from l, c returning id`);

    const seen: string[] = [];
    let path: string | null = "/provider";
    let displacedPage: string | null = null;
    for (let pages = 0; path !== null; pages++) {
      expect(pages).toBeLessThan(40);
      const page = await ownerBrowser.send(path);
      expect(page.status).toBe(200);
      const ids = [...page.body.matchAll(/data-claim="([0-9a-f-]{36})"/g)].map(
        (m) => m[1] ?? "",
      );
      expect(ids.length).toBeLessThanOrEqual(50);
      seen.push(...ids);
      if (ids.includes(displaced)) displacedPage = page.body;
      const tag = /<a\b[^>]*\bdata-claims-older\b[^>]*>/.exec(page.body)?.[0];
      const next =
        tag === undefined ? undefined : /href="([^"]+)"/.exec(tag)?.[1];
      path = next === undefined ? null : next.replaceAll("&amp;", "&");
    }
    expect(new Set(seen).size).toBe(seen.length);
    expect(new Set(seen)).toEqual(new Set([...pending, displaced]));
    expect(seen).not.toContain(other);
    expect(seen.at(-1)).toBe(displaced);
    expect(displacedPage).toMatch(
      new RegExp(`data-claim="${displaced}"[\\s\\S]*?Dispute this claim`),
    );

    const disputed = await ownerBrowser.send("/provider", {
      form: {
        intent: "dispute",
        claim: displaced,
        reason: "Synthetic: I still run this business",
      },
    });
    expect(disputed.status).toBe(302);
    expect(
      sqlRows(
        `select status from public.listing_claims where id = '${displaced}'`,
      ),
    ).toEqual(["disputed"]);

    expect(
      (await ownerBrowser.send("/provider?claims=not-a-cursor")).status,
    ).toBe(404);
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
    await browser.send("/provider/get-listed/business");
    const reply = await browser.send("/provider/get-listed/business", {
      form: { intent: "save", businessName: fixed.businessName, role: "owner" },
      origin: "https://evil.example",
    });
    expect(reply.status).toBe(403);
  });
});
