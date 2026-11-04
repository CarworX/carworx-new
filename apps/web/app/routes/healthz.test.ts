import { describe, expect, it } from "vitest";

import { HEALTH_BODY, loader } from "./healthz";

describe("GET /healthz", () => {
  it("returns 200 with a JSON body", async () => {
    const response = loader();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(await response.json()).toEqual({
      status: "ok",
      service: "carworx-web",
    });
  });

  it("is never cached", () => {
    expect(loader().headers.get("Cache-Control")).toBe("no-store");
  });

  it("exposes only the fixed status fields", async () => {
    const body: unknown = await loader().json();

    expect(Object.keys(body as object).sort()).toEqual(["service", "status"]);
    expect(body).toEqual(HEALTH_BODY);
  });
});
