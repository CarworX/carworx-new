import { describe, expect, it } from "vitest";
import { initials, memberRole, teamProblem } from "./forms";
import { readTeamMembers } from "./server";

const row = {
  id: "d5420000-0000-4000-8000-000000000001",
  user_id: "d5400000-0000-4000-8000-000000000001",
  role: "owner",
  display_name: "Olu Owner",
  created_at: "2026-11-24T08:00:00Z",
};

describe("team member list boundary", () => {
  it("keeps only id, user, role and display name", () => {
    expect(
      readTeamMembers([{ ...row, email: "private@example.test" }]),
    ).toEqual([
      {
        id: row.id,
        user_id: row.user_id,
        role: "owner",
        display_name: "Olu Owner",
      },
    ]);
  });

  it("accepts a member with no name yet", () => {
    expect(
      readTeamMembers([{ ...row, display_name: null }])?.[0],
    ).toMatchObject({ display_name: null });
  });

  it("rejects anything malformed", () => {
    expect(readTeamMembers(null)).toBeNull();
    expect(readTeamMembers([{ ...row, role: "admin" }])).toBeNull();
    expect(readTeamMembers([{ ...row, id: "not-a-uuid" }])).toBeNull();
    expect(readTeamMembers([{ ...row, display_name: 7 }])).toBeNull();
    expect(
      readTeamMembers([{ ...row, display_name: "x".repeat(121) }]),
    ).toBeNull();
    expect(readTeamMembers(Array.from({ length: 101 }, () => row))).toBeNull();
  });
});

describe("team member display", () => {
  it("builds initials from up to two words", () => {
    expect(initials("Sipho Dlamini")).toBe("SD");
    expect(initials("  thabo  ")).toBe("T");
    expect(initials("Ayanda Noma Khumalo")).toBe("AN");
    expect(initials(null)).toBe("…");
    expect(initials("")).toBe("…");
  });
});

describe("role changes", () => {
  it("only moves between manager and staff", () => {
    expect(memberRole("manager")).toBe("manager");
    expect(memberRole("staff")).toBe("staff");
    expect(memberRole("owner")).toBeNull();
    expect(memberRole("")).toBeNull();
  });

  it("explains the last-owner rule", () => {
    expect(teamProblem({ code: "P0001", message: "last_owner" })).toBe(
      "last_owner",
    );
  });
});
