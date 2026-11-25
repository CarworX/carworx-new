import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  Browser,
  confirmLink,
  createConfirmedUser,
  mailTo,
  media,
  PASSWORD,
  signIn,
  sql,
  sqlRows,
  syntheticEmail,
} from "./harness";

// Finish-build PR 6 (D-098): profile fields through the built Worker, real
// Auth (with its local mail catcher) and PostgreSQL/RLS, with an in-memory
// MEDIA bucket. Synthetic people and synthetic images only.
const PATH = "/account/profile";
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

function photoForm(photo: File) {
  const form = new FormData();
  form.set("intent", "upload-photo");
  form.set("photo", photo);
  return form;
}

async function person(label: string) {
  const user = await createConfirmedUser(label);
  sql(
    `insert into public.profiles(id, display_name) values ('${user.id}', 'Profile ${label} (synthetic)')`,
  );
  return user;
}
const photoKey = (id: string) =>
  sqlRows(
    `select object_key from public.profile_photos where user_id='${id}'`,
  )[0];

describe("Account › Profile", () => {
  it("saves an optional South African mobile number, privately", async () => {
    const user = await person("mobile");
    const browser = await signIn(user.email);
    const page = await browser.send(PATH);
    expect(page.status).toBe(200);
    expect(page.body).toContain("Mobile number (optional)");

    const saved = await browser.send(PATH, {
      form: {
        intent: "profile",
        displayName: "Mobile Person (synthetic)",
        mobile: "072 000 0000",
      },
    });
    expect(saved.status).toBe(200);
    expect(
      sqlRows(`select mobile from public.profiles where id='${user.id}'`),
    ).toEqual(["+27720000000"]);
    expect((await browser.send(PATH)).body).toContain('value="072 000 0000"');

    const bad = await browser.send(PATH, {
      form: {
        intent: "profile",
        displayName: "Mobile",
        mobile: "+44 20 7946 0000",
      },
    });
    expect(bad.status).toBe(400);
    expect(bad.body).toContain("South African mobile");
    expect(
      sqlRows(`select mobile from public.profiles where id='${user.id}'`),
    ).toEqual(["+27720000000"]);

    const forged = await browser.send(PATH, {
      form: { intent: "profile", displayName: "Mobile", mobile: "" },
      csrf: false,
    });
    expect(forged.status).toBe(403);
    const cleared = await browser.send(PATH, {
      form: { intent: "profile", displayName: "Mobile", mobile: "" },
    });
    expect(cleared.status).toBe(200);
    expect(
      sqlRows(
        `select coalesce(mobile, 'none') from public.profiles where id='${user.id}'`,
      ),
    ).toEqual(["none"]);

    const signedOut = await new Browser().send(PATH);
    expect(signedOut.status).toBe(302);
    expect(signedOut.location).toContain("/auth/sign-in");
  });

  it("adds a profile photo with its GPS removed, visible only to its owner", async () => {
    const user = await person("photo");
    const browser = await signIn(user.email);
    const page = await browser.send(PATH);
    expect(page.body).toContain("JPEG, PNG or WebP, up to 5 MB");
    expect(page.body).toMatch(/encType="multipart\/form-data"/i);

    const saved = await browser.send(PATH, {
      multipart: photoForm(file("gps.jpg")),
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toContain("Your photo is saved");
    const key = photoKey(user.id) ?? "";
    expect(key).toMatch(/^avatars\/[0-9a-f]{32}\.jpg$/);
    const stored = media.get(key);
    expect(stored?.type).toBe("image/jpeg");
    expect(text(stored?.bytes ?? new Uint8Array())).not.toContain("SECRET");

    const own = await browser.send("/account/photo");
    expect(own.status).toBe(200);
    expect(own.headers.get("Content-Type")).toBe("image/jpeg");
    expect(own.headers.get("Cache-Control")).toBe("private, no-store");
    expect(own.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(own.bytes).toEqual(stored?.bytes);

    // Someone else gets their own (none), never this one; signed out: sign in.
    const other = await signIn((await person("photo-other")).email);
    expect((await other.send("/account/photo")).status).toBe(404);
    const signedOut = await new Browser().send("/account/photo");
    expect(signedOut.status).toBe(302);
    // And the public media route never serves avatars.
    expect(
      (await new Browser().send(`/media/${key.replace("avatars/", "covers/")}`))
        .status,
    ).toBe(404);

    // Replacing queues the old file; removing queues the new one.
    await browser.send(PATH, {
      multipart: photoForm(file("meta.png", "p.png", "image/png")),
    });
    const second = photoKey(user.id) ?? "";
    expect(second).toMatch(/^avatars\/[0-9a-f]{32}\.png$/);
    expect(
      sqlRows(
        `select reason from private.media_deletions where object_key='${key}'`,
      ),
    ).toEqual(["replaced"]);
    const removed = await browser.send(PATH, {
      form: { intent: "remove-photo" },
    });
    expect(removed.status).toBe(200);
    expect(photoKey(user.id)).toBeUndefined();
    expect((await browser.send("/account/photo")).status).toBe(404);
    expect(
      sqlRows(
        `select reason from private.media_deletions where object_key='${second}'`,
      ),
    ).toEqual(["removed"]);
  });

  it("refuses fake images, oversize photos and uploads without CSRF", async () => {
    const user = await person("photo-bad");
    const browser = await signIn(user.email);
    await browser.send(PATH);
    const before = media.size;
    for (const photo of [
      file("not-an-image.jpg"),
      file("animated.png", "a.png", "image/png"),
      file("too-wide.png", "w.png", "image/png"),
    ]) {
      const refused = await browser.send(PATH, { multipart: photoForm(photo) });
      expect(refused.status).toBe(400);
    }
    const oneOver = await browser.send(PATH, {
      multipart: photoForm(
        new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.jpg", {
          type: "image/jpeg",
        }),
      ),
    });
    expect(oneOver.status).toBe(413);
    expect(oneOver.body).toContain("up to 5 MB");
    const huge = await browser.send(PATH, {
      multipart: photoForm(
        new File([new Uint8Array(6 * 1024 * 1024)], "huge.jpg", {
          type: "image/jpeg",
        }),
      ),
    });
    expect(huge.status).toBe(413);
    const forged = await browser.send(PATH, {
      multipart: photoForm(file("gps.jpg")),
      csrf: false,
    });
    expect(forged.status).toBe(403);
    expect(media.size).toBe(before);
    expect(photoKey(user.id)).toBeUndefined();
  });

  it("changes the email only after both addresses confirm", async () => {
    const user = await person("email");
    const next = syntheticEmail("email-next");
    const browser = await signIn(user.email);
    await browser.send(PATH);
    const taken = await createConfirmedUser("email-taken");
    const inUse = await browser.send(PATH, {
      form: { intent: "change-email", email: taken.email },
    });
    expect([409, 200]).toContain(inUse.status);

    const started = await browser.send(PATH, {
      form: { intent: "change-email", email: next },
    });
    expect(started.status).toBe(200);
    expect(started.body).toContain("Check both inboxes");
    expect((await browser.send(PATH)).body).toContain(
      `Waiting for you to confirm ${next}`,
    );
    // Not changed yet.
    expect(
      sqlRows(`select email from auth.users where id='${user.id}'`),
    ).toEqual([user.email]);

    const [toOld] = await mailTo(user.email);
    const [toNew] = await mailTo(next);
    const first = confirmLink(toOld ?? "");
    const second = confirmLink(toNew ?? "");
    expect(first).toContain("type=email_change");
    const visitor = new Browser();
    const page = await visitor.send(first);
    expect(page.body).toContain("Confirm the change");
    const one = await visitor.send("/auth/confirm", {
      form: {
        token_hash:
          new URL(first, "http://x").searchParams.get("token_hash") ?? "",
        type: "email_change",
      },
    });
    expect(one.status).toBe(302);
    expect(one.location).toBe("/account/profile?email=half");
    expect(
      sqlRows(`select email from auth.users where id='${user.id}'`),
    ).toEqual([user.email]);
    const two = await visitor.send("/auth/confirm", {
      form: {
        token_hash:
          new URL(second, "http://x").searchParams.get("token_hash") ?? "",
        type: "email_change",
      },
    });
    expect(two.status).toBe(302);
    expect(two.location).toBe("/account/profile?email=confirmed");
    expect(
      sqlRows(`select email from auth.users where id='${user.id}'`),
    ).toEqual([next]);
    // The new address now signs in with the same password.
    const again = await signIn(next, PASSWORD);
    expect((await again.send(PATH)).status).toBe(200);
  });
});
