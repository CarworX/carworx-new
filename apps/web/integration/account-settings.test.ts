import { describe, expect, it } from "vitest";

import {
  asUser,
  Browser,
  createConfirmedUser,
  signIn,
  sqlRows,
} from "./harness";

// Real Worker -> Auth -> PostgREST/RLS. Synthetic users and names only.
describe("canonical account profile", () => {
  it("creates and updates the canonical profile while ignoring Auth metadata", async () => {
    const user = await createConfirmedUser("settings-canonical", {
      user_metadata: { display_name: "Synthetic metadata is not the profile" },
    });
    const browser = await signIn(user.email);
    const before = await browser.send("/account/profile");
    expect(before.status).toBe(200);
    expect(before.body).not.toContain("Synthetic metadata is not the profile");
    expect(
      sqlRows(`select count(*) from public.profiles where id = '${user.id}'`),
    ).toEqual(["0"]);

    const created = await browser.send("/account/profile", {
      form: { intent: "profile", displayName: "  Synthetic canonical name  " },
    });
    expect(created.status).toBe(200);
    expect(created.body).toContain("Your profile is saved.");
    expect(created.headers.get("Cache-Control")).toMatch(/private.*no-store/);
    expect(
      sqlRows(
        `select display_name from public.profiles where id = '${user.id}'`,
      ),
    ).toEqual(["Synthetic canonical name"]);
    expect((await browser.send("/account/profile")).body).toContain(
      'value="Synthetic canonical name"',
    );

    const updated = await browser.send("/account/profile", {
      form: { intent: "profile", displayName: "Synthetic revised name" },
    });
    expect(updated.status).toBe(200);
    expect(
      sqlRows(
        `select display_name from public.profiles where id = '${user.id}'`,
      ),
    ).toEqual(["Synthetic revised name"]);
    expect((await browser.send("/account/profile")).body).toContain(
      'value="Synthetic revised name"',
    );
    const own = asUser(browser.session().access_token);
    const canonical = await own
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single<{ display_name: string }>();
    expect(canonical.error).toBeNull();
    expect(canonical.data?.display_name).toBe("Synthetic revised name");
    const authUser = await own.auth.getUser();
    expect(authUser.error).toBeNull();
    expect(authUser.data.user?.user_metadata["display_name"]).toBe(
      "Synthetic metadata is not the profile",
    );
  });

  it("ignores a forged profile ID and keeps other users protected by RLS", async () => {
    const owner = await createConfirmedUser("settings-other-owner");
    const ownerBrowser = await signIn(owner.email);
    await ownerBrowser.send("/account/profile");
    expect(
      (
        await ownerBrowser.send("/account/profile", {
          form: { intent: "profile", displayName: "Synthetic protected name" },
        })
      ).status,
    ).toBe(200);

    const attacker = await createConfirmedUser("settings-other-attacker");
    const browser = await signIn(attacker.email);
    await browser.send("/account/profile");
    const forged = await browser.send("/account/profile", {
      form: {
        intent: "profile",
        id: owner.id,
        displayName: "Synthetic attacker own name",
      },
    });
    expect(forged.status).toBe(200);
    expect(
      sqlRows(
        `select display_name from public.profiles where id = '${owner.id}'`,
      ),
    ).toEqual(["Synthetic protected name"]);
    expect(
      sqlRows(
        `select display_name from public.profiles where id = '${attacker.id}'`,
      ),
    ).toEqual(["Synthetic attacker own name"]);

    const db = asUser(browser.session().access_token);
    const hidden = await db.from("profiles").select("id").eq("id", owner.id);
    expect(hidden.data ?? []).toEqual([]);
    const denied = await db
      .from("profiles")
      .update({ display_name: "Synthetic forbidden change" })
      .eq("id", owner.id)
      .select("id");
    expect(denied.data ?? []).toEqual([]);
    expect(
      sqlRows(
        `select display_name from public.profiles where id = '${owner.id}'`,
      ),
    ).toEqual(["Synthetic protected name"]);
  });

  it("rejects blank names without changing the saved profile", async () => {
    const user = await createConfirmedUser("settings-blank");
    const browser = await signIn(user.email);
    await browser.send("/account/profile");
    await browser.send("/account/profile", {
      form: { intent: "profile", displayName: "Synthetic retained name" },
    });
    for (const displayName of ["", "   "]) {
      const invalid = await browser.send("/account/profile", {
        form: { intent: "profile", displayName },
      });
      expect(invalid.status).toBe(400);
      expect(invalid.body).not.toContain("Your profile is saved.");
    }
    expect(
      sqlRows(
        `select display_name from public.profiles where id = '${user.id}'`,
      ),
    ).toEqual(["Synthetic retained name"]);
  });

  it("requires sign-in and rejects cross-site profile changes", async () => {
    const anonymous = await new Browser().send("/account/profile");
    expect(anonymous.status).toBe(302);
    expect(anonymous.location).toContain("/auth/sign-in");
    const user = await createConfirmedUser("settings-csrf");
    const browser = await signIn(user.email);
    await browser.send("/account/profile");
    const denied = await browser.send("/account/profile", {
      form: { intent: "profile", displayName: "Synthetic forbidden origin" },
      origin: "https://untrusted.example",
    });
    expect(denied.status).toBe(403);
    expect(
      sqlRows(`select count(*) from public.profiles where id = '${user.id}'`),
    ).toEqual(["0"]);
  });
});
