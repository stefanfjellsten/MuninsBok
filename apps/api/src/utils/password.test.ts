import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing", () => {
  it("hashPassword returns salt:hash format", async () => {
    const hashed = await hashPassword("test-password");
    const parts = hashed.split(":");
    expect(parts).toHaveLength(2);
    // 16-byte salt → 32 hex chars, 64-byte hash → 128 hex chars
    expect(parts[0]).toHaveLength(32);
    expect(parts[1]).toHaveLength(128);
  });

  it("hashPassword produces unique hashes for same password", async () => {
    const hash1 = await hashPassword("same-password");
    const hash2 = await hashPassword("same-password");
    expect(hash1).not.toBe(hash2);
  });

  it("verifyPassword returns true for correct password", async () => {
    const hashed = await hashPassword("correct-password");
    const result = await verifyPassword("correct-password", hashed);
    expect(result).toBe(true);
  });

  it("verifyPassword returns false for wrong password", async () => {
    const hashed = await hashPassword("correct-password");
    const result = await verifyPassword("wrong-password", hashed);
    expect(result).toBe(false);
  });

  it("verifyPassword returns false for malformed stored hash", async () => {
    expect(await verifyPassword("any", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("any", "")).toBe(false);
  });

  it("handles unicode passwords", async () => {
    const hashed = await hashPassword("lösenörd-åäö-🔑");
    expect(await verifyPassword("lösenörd-åäö-🔑", hashed)).toBe(true);
    expect(await verifyPassword("losenord-aao", hashed)).toBe(false);
  });
});
