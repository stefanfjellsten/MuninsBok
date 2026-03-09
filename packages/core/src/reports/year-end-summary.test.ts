import { describe, it, expect } from "vitest";
import { calculateYearEndSummary } from "./year-end-summary.js";
import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";
import type { VoucherLine } from "../types/voucher-line.js";
import type { FiscalYear } from "../types/fiscal-year.js";

// ── Helpers ─────────────────────────────────────────────────

function line(accountNumber: string, debit: number, credit: number): VoucherLine {
  return { id: `l-${accountNumber}`, voucherId: "v", accountNumber, debit, credit };
}

function voucher(lines: VoucherLine[]): Voucher {
  return {
    id: "v-1",
    organizationId: "org",
    fiscalYearId: "fy-2024",
    number: 1,
    date: new Date("2024-06-15"),
    description: "Test",
    lines,
    documentIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const baseFy: FiscalYear = {
  id: "fy-2024",
  organizationId: "org",
  startDate: new Date("2024-01-01"),
  endDate: new Date("2024-12-31"),
  isClosed: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const accounts: Account[] = [
  { number: "1930", name: "Bank", type: "ASSET", isVatAccount: false, isActive: true },
  {
    number: "2091",
    name: "Balanserat resultat",
    type: "EQUITY",
    isVatAccount: false,
    isActive: true,
  },
  { number: "2099", name: "Årets resultat", type: "EQUITY", isVatAccount: false, isActive: true },
  { number: "3000", name: "Försäljning", type: "REVENUE", isVatAccount: false, isActive: true },
  { number: "5010", name: "Lokalkostnad", type: "EXPENSE", isVatAccount: false, isActive: true },
];

// ── Tests ───────────────────────────────────────────────────

describe("calculateYearEndSummary", () => {
  it("includes income statement and balance sheet", () => {
    const vouchers = [
      voucher([line("1930", 200_000, 0), line("3000", 0, 200_000)]),
      voucher([line("5010", 80_000, 0), line("1930", 0, 80_000)]),
    ];

    const summary = calculateYearEndSummary(baseFy, vouchers, accounts);

    expect(summary.incomeStatement.netResult).toBe(120_000);
    expect(summary.balanceSheet.yearResult).toBe(120_000);
    expect(summary.disposition).toBeNull();
    expect(summary.isDisposed).toBe(false);
  });

  it("returns disposition preview for closed year with target", () => {
    const closedFy = { ...baseFy, isClosed: true };
    const vouchers = [
      // Revenue entry
      voucher([line("1930", 200_000, 0), line("3000", 0, 200_000)]),
      // Closing voucher: zero P&L, book to 2099
      voucher([line("3000", 200_000, 0), line("2099", 0, 200_000)]),
    ];

    const summary = calculateYearEndSummary(closedFy, vouchers, accounts, "fy-2025");

    expect(summary.disposition).not.toBeNull();
    expect(summary.disposition!.netResult).toBe(200_000);
    expect(summary.disposition!.targetFiscalYearId).toBe("fy-2025");
    expect(summary.disposition!.lines).toHaveLength(2);
  });

  it("returns no disposition for open year", () => {
    const vouchers = [voucher([line("1930", 100_000, 0), line("3000", 0, 100_000)])];

    const summary = calculateYearEndSummary(baseFy, vouchers, accounts, "fy-2025");
    expect(summary.disposition).toBeNull();
  });

  it("returns no disposition without target fiscal year", () => {
    const closedFy = { ...baseFy, isClosed: true };
    const vouchers = [
      voucher([line("1930", 100_000, 0), line("3000", 0, 100_000)]),
      // Closing voucher
      voucher([line("3000", 100_000, 0), line("2099", 0, 100_000)]),
    ];

    const summary = calculateYearEndSummary(closedFy, vouchers, accounts);
    expect(summary.disposition).toBeNull();
  });

  it("marks as disposed when 2099 balance is zero after closing", () => {
    const closedFy = { ...baseFy, isClosed: true };
    // Simulate: revenue booked, then closing voucher zeroed P&L and 2099 also = 0
    // This means the result was already disposed
    const vouchers = [
      voucher([line("1930", 100_000, 0), line("3000", 0, 100_000)]),
      // Closing voucher: debit 3000, credit 2099
      voucher([line("3000", 100_000, 0), line("2099", 0, 100_000)]),
      // Disposition: debit 2099, credit 2091
      voucher([line("2099", 100_000, 0), line("2091", 0, 100_000)]),
    ];

    const summary = calculateYearEndSummary(closedFy, vouchers, accounts, "fy-2025");
    expect(summary.isDisposed).toBe(true);
    expect(summary.disposition).toBeNull();
  });

  it("preserves fiscal year info", () => {
    const summary = calculateYearEndSummary(baseFy, [], accounts);
    expect(summary.fiscalYear.id).toBe("fy-2024");
    expect(summary.fiscalYear.startDate).toEqual(new Date("2024-01-01"));
    expect(summary.fiscalYear.endDate).toEqual(new Date("2024-12-31"));
    expect(summary.fiscalYear.isClosed).toBe(false);
  });

  it("handles empty vouchers", () => {
    const summary = calculateYearEndSummary(baseFy, [], accounts);
    expect(summary.incomeStatement.netResult).toBe(0);
    expect(summary.balanceSheet.totalAssets).toBe(0);
    expect(summary.disposition).toBeNull();
    expect(summary.isDisposed).toBe(false);
  });
});
