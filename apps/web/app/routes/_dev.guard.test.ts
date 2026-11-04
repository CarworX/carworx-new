import { describe, expect, it } from "vitest";

import { DEV_HEADERS, devPagesEnabled } from "./_dev.guard";

const req = (url: string) => new Request(url);

describe("/_dev guard (D11)", () => {
  it("is open on localhost and in the dev server", () => {
    expect(
      devPagesEnabled(req("http://localhost:4173/_dev/components"), {}, false),
    ).toBe(true);
    expect(
      devPagesEnabled(req("http://127.0.0.1:8787/_dev/components"), {}, false),
    ).toBe(true);
    expect(
      devPagesEnabled(req("https://carworx.example/_dev/components"), {}, true),
    ).toBe(true);
  });
  it("is closed on any deployed host without the staging flag", () => {
    expect(
      devPagesEnabled(
        req("https://carworx.example/_dev/components"),
        {},
        false,
      ),
    ).toBe(false);
    expect(
      devPagesEnabled(
        req("https://carworx.example/_dev/components"),
        { CARWORX_DEV_PAGES: "true" },
        false,
      ),
    ).toBe(false);
    expect(
      devPagesEnabled(
        req("https://carworx.example/_dev/components"),
        undefined,
        false,
      ),
    ).toBe(false);
  });
  it("opens on a deployed host only with CARWORX_DEV_PAGES=1", () => {
    expect(
      devPagesEnabled(
        req("https://staging.carworx.example/_dev/components"),
        { CARWORX_DEV_PAGES: "1" },
        false,
      ),
    ).toBe(true);
  });
  it("is never indexed or cached", () => {
    expect(DEV_HEADERS["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(DEV_HEADERS["Cache-Control"]).toBe("no-store");
  });
});
