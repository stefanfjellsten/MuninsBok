import { describe, it, expect } from "vitest";
import type { User, SafeUser, OrganizationMember, MemberRole } from "./user.js";

describe("User types", () => {
  const now = new Date();

  const user: User = {
    id: "user-1",
    email: "anna@example.com",
    name: "Anna Svensson",
    passwordHash: "$scrypt$N=16384,r=8,p=1$c2FsdA$aGFzaA",
    createdAt: now,
    updatedAt: now,
  };

  it("User has all required fields", () => {
    expect(user.id).toBe("user-1");
    expect(user.email).toBe("anna@example.com");
    expect(user.name).toBe("Anna Svensson");
    expect(user.passwordHash).toContain("scrypt");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("SafeUser omits passwordHash", () => {
    const { passwordHash: _, ...safe } = user;
    const safeUser: SafeUser = safe;

    expect(safeUser.id).toBe("user-1");
    expect(safeUser.email).toBe("anna@example.com");
    expect("passwordHash" in safeUser).toBe(false);
  });

  it("OrganizationMember has role", () => {
    const member: OrganizationMember = {
      id: "mem-1",
      userId: "user-1",
      organizationId: "org-1",
      role: "OWNER",
      createdAt: now,
    };

    expect(member.role).toBe("OWNER");
    expect(member.userId).toBe("user-1");
    expect(member.organizationId).toBe("org-1");
  });

  it("MemberRole accepts valid values", () => {
    const roles: MemberRole[] = ["OWNER", "ADMIN", "MEMBER"];
    expect(roles).toHaveLength(3);
    expect(roles).toContain("OWNER");
    expect(roles).toContain("ADMIN");
    expect(roles).toContain("MEMBER");
  });
});
