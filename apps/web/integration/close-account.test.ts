import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";

import {
  Browser,
  createConfirmedUser,
  createOrganisation,
  PASSWORD,
  signIn,
  sql,
  sqlRows,
  stack,
  workerEnv,
} from "./harness";

// Finish-build PR 4b (D-098, owner 2026-11-24): close my account through the
// built Worker, real Auth and PostgreSQL, and the daily deletion run as the
// scoped retention_server login. Synthetic people only.
const PATH = "/account/privacy";
const password = `synthetic-${randomUUID()}`;
const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} };

beforeAll(() => {
  const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  sql(
    `alter role retention_server password '${password}' valid until '${until}'`,
  );
});
afterAll(() => {
  sql("alter role retention_server password null");
});

async function staff(label: string) {
  const user = await createConfirmedUser(label);
  const org = await createOrganisation(`Close ${label}`);
  const owner = await createConfirmedUser(`${label}-owner`);
  sql(`insert into public.profiles(id, display_name) values ('${user.id}', 'Close ${label} (synthetic)');
    insert into public.memberships(organisation_id,user_id,role) values
      ('${org}','${owner.id}','owner'),('${org}','${user.id}','staff')`);
  onTestFinished(() => {
    sql(`delete from private.account_closures where user_id='${user.id}';
      delete from public.memberships where organisation_id='${org}';
      delete from public.organisations where id='${org}'`);
  });
  return { ...user, org, owner };
}

const closing = (id: string) =>
  sqlRows(
    `select count(*) from private.account_closures where user_id='${id}'`,
  );

describe("close my account", () => {
  it("re-confirms with the password, closes at once and signs out everywhere", async () => {
    const user = await staff("close-own");
    const browser = await signIn(user.email);
    const page = await browser.send(PATH);
    expect(page.body).toContain("Delete my account");
    expect(page.body).toContain("We keep your data for 14 days");

    const unticked = await browser.send(PATH, {
      form: { intent: "close-account", password: PASSWORD },
    });
    expect(unticked.status).toBe(400);
    const wrong = await browser.send(PATH, {
      form: {
        intent: "close-account",
        password: "not-the-password",
        understand: "on",
      },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toContain("That password isn");
    expect(closing(user.id)).toEqual(["0"]);

    const second = await signIn(user.email); // another device
    const closed = await browser.send(PATH, {
      form: { intent: "close-account", password: PASSWORD, understand: "on" },
    });
    expect(closed.status).toBe(302);
    expect(closed.location).toMatch(
      /^\/account\/closed\?on=\d{4}-\d{2}-\d{2}$/,
    );
    expect(closing(user.id)).toEqual(["1"]);
    expect(
      sqlRows(
        `select status from public.memberships where user_id='${user.id}'`,
      ),
    ).toEqual(["revoked"]);
    const notice = await new Browser().send(closed.location ?? "");
    expect(notice.body).toContain("Your account is closed");
    expect(notice.body).toContain("Sign in before then");
    // Signed out on every device.
    const other = await second.send("/account/profile");
    expect(other.status).toBe(302);
    expect(other.location).toContain("/auth/sign-in");
  });

  it("asks to reinstate after signing back in, and restores nothing silently", async () => {
    const user = await staff("close-back");
    const browser = await signIn(user.email);
    await browser.send(PATH);
    await browser.send(PATH, {
      form: { intent: "close-account", password: PASSWORD, understand: "on" },
    });

    const again = await signIn(user.email);
    const home = await again.send("/account/profile");
    expect(home.status).toBe(302);
    expect(home.location).toBe("/account/closing");
    const page = await again.send("/account/closing");
    expect(page.status).toBe(200);
    expect(page.body).toContain("Reinstate my account");
    expect(page.body).toContain("will be deleted on");
    // A closing account is signed out on public pages too.
    expect((await again.send("/account/privacy")).location).toBe(
      "/account/closing",
    );

    const back = await again.send("/account/closing", {
      form: { intent: "reinstate" },
    });
    expect(back.status).toBe(302);
    expect(back.location).toBe("/account/profile?reinstated=1");
    expect(closing(user.id)).toEqual(["0"]);
    expect((await again.send("/account/profile")).status).toBe(200);
    // Team memberships are not restored.
    expect(
      sqlRows(
        `select status from public.memberships where user_id='${user.id}'`,
      ),
    ).toEqual(["revoked"]);
  });

  it("stops a sole owner and refuses without CSRF", async () => {
    const user = await staff("close-owner");
    const owner = await signIn(user.owner.email);
    await owner.send(PATH);
    const refused = await owner.send(PATH, {
      form: { intent: "close-account", password: PASSWORD, understand: "on" },
    });
    expect(refused.status).toBe(409);
    expect(refused.body).toContain("only owner of a business");
    expect(closing(user.owner.id)).toEqual(["0"]);

    const browser = await signIn(user.email);
    await browser.send(PATH);
    const noCsrf = await browser.send(PATH, {
      form: { intent: "close-account", password: PASSWORD, understand: "on" },
      csrf: false,
    });
    expect(noCsrf.status).toBe(403);
    expect(closing(user.id)).toEqual(["0"]);
    expect((await new Browser().send(PATH)).location).toContain(
      "/auth/sign-in",
    );
  });

  it("deletes the account 14 days later in the daily run", async () => {
    const user = await staff("close-gone");
    const browser = await signIn(user.email);
    await browser.send(PATH);
    await browser.send(PATH, {
      form: { intent: "close-account", password: PASSWORD, understand: "on" },
    });
    sql(`update private.account_closures set requested_at = now() - interval '15 days',
      delete_after = now() - interval '1 day' where user_id='${user.id}'`);
    // Overdue but not yet deleted: still signed out, and no reinstating.
    const late = await signIn(user.email);
    expect((await late.send("/account/profile")).location).toBe(
      "/account/closing",
    );
    const lateNotice = await late.send("/account/closing");
    expect(lateNotice.body).toContain("can no longer be reinstated");
    expect(lateNotice.body).not.toContain("Reinstate my account");
    const module = (await import(
      pathToFileURL(
        join(import.meta.dirname, "..", "build", "server", "index.js"),
      ).href
    )) as {
      default: { scheduled(c: unknown, e: unknown, x: unknown): Promise<void> };
    };
    const url = new URL(stack.dbUrl);
    url.username = "retention_server";
    url.password = password;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await module.default.scheduled(
        { cron: "17 1 * * *", scheduledTime: Date.now() },
        {
          RETENTION_DB: { connectionString: url.toString() },
          MEDIA: workerEnv.MEDIA,
        },
        ctx,
      );
      const line = log.mock.calls
        .map((c) => String(c[0]))
        .find((l) => l.includes("retention_accounts"));
      expect(JSON.parse(line ?? "{}")).toMatchObject({
        deleted: 1,
        emailed: 0,
      });
      expect(line).not.toMatch(/example\.test|@/);
    } finally {
      log.mockRestore();
    }
    expect(
      sqlRows(`select count(*) from auth.users where id='${user.id}'`),
    ).toEqual(["0"]);
    expect(
      sqlRows(`select count(*) from public.profiles where id='${user.id}'`),
    ).toEqual(["0"]);
  });
});
