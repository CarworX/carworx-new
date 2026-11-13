import { describe, expect, it } from "vitest";
import {
  assignment,
  inviteRole,
  staffProfile,
  teamProblem,
  visibility,
} from "./forms";

function form(values: Record<string, string | string[]>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(values))
    for (const item of Array.isArray(value) ? value : [value])
      result.append(key, item);
  return result;
}

describe("team capabilities", () => {
  it("allows managers to invite staff only and never invites an owner", () => {
    expect(inviteRole("staff", "manager")).toBe("staff");
    expect(inviteRole("manager", "manager")).toBeNull();
    expect(inviteRole("manager", "owner")).toBe("manager");
    expect(inviteRole("owner", "owner")).toBeNull();
    expect(inviteRole("staff", "staff")).toBeNull();
  });
  it("drops anyone-available when the business assigns", () => {
    expect(
      assignment(form({ assignMode: "business", offerAnyone: "on" })),
    ).toEqual({
      assign_mode: "business",
      offer_anyone: false,
    });
    expect(
      assignment(form({ assignMode: "customer", offerAnyone: "on" }))
        ?.offer_anyone,
    ).toBe(true);
    expect(assignment(form({ assignMode: "all" }))).toBeNull();
    expect(visibility(form({ visibility: "everything" }))).toBeNull();
  });
  it("stores first name only when customers choose, and bounds service/day selections", () => {
    const input = form({
      firstName: "Test",
      services: ["wash", "wash"],
      days: ["7", "1", "1"],
    });
    expect(staffProfile(input, "customer", ["wash"])).toEqual({
      first_name: "Test",
      service_slugs: ["wash"],
      days: [1, 7],
    });
    expect(staffProfile(input, "business", ["wash"])?.first_name).toBeNull();
    expect(staffProfile(input, "customer", ["tyres"])).toBeNull();
    expect(staffProfile(form({ days: ["8"] }), "business", [])).toBeNull();
    expect(staffProfile(form({ firstName: "" }), "customer", [])).toBeNull();
    expect(
      staffProfile(form({ firstName: "A\u0000B" }), "customer", []),
    ).toBeNull();
  });
  it("never echoes database details or token failure distinctions", () => {
    expect(teamProblem({ message: "invite_invalid" })).toBe("invite_invalid");
    expect(teamProblem({ code: "PGRST301", message: "sensitive" })).toBe(
      "unavailable",
    );
  });
});
