import { describe, expect, it } from "vitest";

import { loader } from "./fines";

describe("/fines", () => {
  it("sends visitors to the landing's fines band", () => {
    let thrown: unknown = null;
    try {
      loader();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/#fines");
  });
});
