import { describe, expect, it, onTestFinished } from "vitest";

import {
  Browser,
  createConfirmedUser,
  createOrganisation,
  media,
  signIn,
  sql,
  sqlRows,
} from "./harness";

// Finish-build PR 4a (D-098): "Download my data" through the built Worker,
// real Auth and PostgreSQL, with the in-memory MEDIA bucket. Synthetic only.
const PATH = "/account/privacy";

async function person(label: string) {
  const user = await createConfirmedUser(label);
  sql(
    `insert into public.profiles(id, display_name) values ('${user.id}', 'Export ${label} (synthetic)')`,
  );
  onTestFinished(() => {
    sql(`delete from private.data_exports where user_id='${user.id}'`);
  });
  return user;
}

const linkFrom = (body: string) =>
  /value="http:\/\/localhost:5173(\/account\/data\/[A-Za-z0-9_-]{43})"/.exec(
    body,
  )?.[1];

describe("download my data", () => {
  it("prepares a JSON file and downloads it once through the link", async () => {
    const user = await person("export-own");
    const org = await createOrganisation("Export membership");
    sql(
      `insert into public.memberships(organisation_id,user_id,role) values ('${org}','${user.id}','staff')`,
    );
    onTestFinished(() => {
      sql(`delete from public.memberships where organisation_id='${org}';
        delete from public.organisations where id='${org}'`);
    });
    const browser = await signIn(user.email);
    const page = await browser.send(PATH);
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toBe("private, no-store");
    expect(page.body).toContain("Download my data");

    const requested = await browser.send(PATH, {
      form: { intent: "request-export" },
    });
    expect(requested.status).toBe(200);
    expect(requested.body).toContain("Your data is ready.");
    const link = linkFrom(requested.body);
    if (link === undefined) throw new Error("no export link");
    const token = link.split("/").at(-1) ?? "";
    // Only the SHA-256 of the token is stored; the file is private (exports/).
    expect(
      sqlRows(
        `select count(*) from private.data_exports where user_id='${user.id}' and token_hash = extensions.digest('${token}', 'sha256')`,
      ),
    ).toEqual(["1"]);
    const [key] = sqlRows(
      `select object_key from private.data_exports where user_id='${user.id}'`,
    );
    expect(key).toMatch(/^exports\/[0-9a-f]{32}\.json$/);
    expect((await new Browser().send(`/media/${key ?? ""}`)).status).toBe(404);

    // The link only moves the token into a cookie and redirects.
    const fresh = await signIn(user.email);
    const opened = await fresh.send(link);
    expect(opened.status).toBe(302);
    expect(opened.location).toBe("/account/privacy#your-data");
    expect(opened.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(fresh.jar.has("__Host-cx-export")).toBe(true);
    const ready = await fresh.send(PATH);
    expect(ready.body).toContain("Download my data file");

    const file = await fresh.send("/account/privacy/download", { form: {} });
    expect(file.status).toBe(200);
    expect(file.headers.get("Content-Disposition")).toContain("attachment");
    expect(file.headers.get("Cache-Control")).toBe("private, no-store");
    const doc = JSON.parse(file.body) as {
      format: string;
      account: { email: string; display_name: string };
      memberships: { role: string; business: string }[];
    };
    expect(doc.format).toBe("carworx-personal-data-v1");
    expect(doc.account.email).toBe(user.email);
    expect(doc.memberships[0]?.role).toBe("staff");
    expect(media.has(key ?? "")).toBe(false);

    // Never twice.
    await fresh.send(link);
    const again = await fresh.send("/account/privacy/download", { form: {} });
    expect(again.status).toBe(302);
    expect(again.location).toContain("export=invalid");
  });

  it("allows one request per 24 hours", async () => {
    const user = await person("export-limit");
    const browser = await signIn(user.email);
    await browser.send(PATH);
    expect(
      (await browser.send(PATH, { form: { intent: "request-export" } })).status,
    ).toBe(200);
    const second = await browser.send(PATH, {
      form: { intent: "request-export" },
    });
    expect(second.status).toBe(429);
    expect(second.body).toContain("once every 24 hours");
  });

  it("keeps someone else's link useless, and needs a session and CSRF", async () => {
    const owner = await person("export-owner");
    const ownerBrowser = await signIn(owner.email);
    await ownerBrowser.send(PATH);
    const link =
      linkFrom(
        (await ownerBrowser.send(PATH, { form: { intent: "request-export" } }))
          .body,
      ) ?? "";

    const other = await person("export-other");
    const otherBrowser = await signIn(other.email);
    await otherBrowser.send(link);
    await otherBrowser.send(PATH);
    const stolen = await otherBrowser.send("/account/privacy/download", {
      form: {},
    });
    expect(stolen.status).toBe(302);
    expect(stolen.location).toContain("export=invalid");
    expect(
      sqlRows(
        `select count(*) from private.data_exports where user_id='${owner.id}' and downloaded_at is null`,
      ),
    ).toEqual(["1"]);

    const anonymous = await new Browser().send(PATH);
    expect(anonymous.status).toBe(302);
    expect(anonymous.location).toContain("/auth/sign-in");
    const noCsrf = await otherBrowser.send(PATH, {
      form: { intent: "request-export" },
      csrf: false,
    });
    expect(noCsrf.status).toBe(403);
    expect(
      sqlRows(
        `select count(*) from private.data_exports where user_id='${other.id}'`,
      ),
    ).toEqual(["0"]);
  });
});
