import { describe, it, expect } from "vitest";
import {
  calculateResultDisposition,
  ACCOUNT_YEAR_RESULT,
  ACCOUNT_RETAINED_EARNINGS,
} from "./result-disposition.js";

describe("calculateResultDisposition", () => {
  const closedId = "fy-closed";
  const targetId = "fy-target";

  it("returns error when net result is zero", () => {
    const result = calculateResultDisposition(0, closedId, targetId);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_RESULT");
    }
  });

  it("creates correct lines for profit (positive result)", () => {
    const result = calculateResultDisposition(150_000, closedId, targetId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { value } = result;
    expect(value.netResult).toBe(150_000);
    expect(value.lines).toHaveLength(2);

    // Debit 2099 (remove year result)
    const line2099 = value.lines.find((l) => l.accountNumber === ACCOUNT_YEAR_RESULT)!;
    expect(line2099.debit).toBe(150_000);
    expect(line2099.credit).toBe(0);

    // Credit 2091 (add to retained earnings)
    const line2091 = value.lines.find((l) => l.accountNumber === ACCOUNT_RETAINED_EARNINGS)!;
    expect(line2091.debit).toBe(0);
    expect(line2091.credit).toBe(150_000);
  });

  it("creates correct lines for loss (negative result)", () => {
    const result = calculateResultDisposition(-80_000, closedId, targetId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { value } = result;
    expect(value.netResult).toBe(-80_000);
    expect(value.lines).toHaveLength(2);

    // Credit 2099 (remove year loss)
    const line2099 = value.lines.find((l) => l.accountNumber === ACCOUNT_YEAR_RESULT)!;
    expect(line2099.debit).toBe(0);
    expect(line2099.credit).toBe(80_000);

    // Debit 2091 (reduce retained earnings)
    const line2091 = value.lines.find((l) => l.accountNumber === ACCOUNT_RETAINED_EARNINGS)!;
    expect(line2091.debit).toBe(80_000);
    expect(line2091.credit).toBe(0);
  });

  it("is always balanced", () => {
    const profit = calculateResultDisposition(500_000, closedId, targetId);
    expect(profit.ok && profit.value.isBalanced).toBe(true);

    const loss = calculateResultDisposition(-300_000, closedId, targetId);
    expect(loss.ok && loss.value.isBalanced).toBe(true);
  });

  it("preserves fiscal year IDs", () => {
    const result = calculateResultDisposition(100, closedId, targetId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closedFiscalYearId).toBe(closedId);
    expect(result.value.targetFiscalYearId).toBe(targetId);
  });

  it("uses correct account names", () => {
    const result = calculateResultDisposition(100, closedId, targetId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const line2099 = result.value.lines.find((l) => l.accountNumber === "2099")!;
    expect(line2099.accountName).toBe("Årets resultat");

    const line2091 = result.value.lines.find((l) => l.accountNumber === "2091")!;
    expect(line2091.accountName).toBe("Balanserat resultat");
  });
});
