import { describe, it, expect } from "vitest";
import { defined } from "./assert";

describe("defined()", () => {
  it("returns the value when non-null", () => {
    expect(defined("hello")).toBe("hello");
    expect(defined(42)).toBe(42);
    expect(defined(0)).toBe(0);
    expect(defined("")).toBe("");
    expect(defined(false)).toBe(false);
  });

  it("throws when value is null", () => {
    expect(() => defined(null)).toThrow("Expected value to be defined");
  });

  it("throws when value is undefined", () => {
    expect(() => defined(undefined)).toThrow("Expected value to be defined");
  });

  it("includes custom name in error message", () => {
    expect(() => defined(null, "organization")).toThrow("Expected organization to be defined");
  });

  it("preserves object references", () => {
    const obj = { id: "org-1" };
    expect(defined(obj)).toBe(obj);
  });
});
