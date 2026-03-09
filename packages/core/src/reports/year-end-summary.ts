/**
 * Year-End Summary (Sammanställning av årsbokslut)
 *
 * Compiles a complete year-end report containing income statement,
 * balance sheet, and result disposition details in a single view.
 *
 * All monetary amounts are in öre (integer cents).
 */

import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";
import type { FiscalYear } from "../types/fiscal-year.js";
import { calculateIncomeStatement, type IncomeStatement } from "./income-statement.js";
import { calculateBalanceSheet, type BalanceSheet } from "./balance-sheet.js";
import {
  calculateResultDisposition,
  ACCOUNT_YEAR_RESULT,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ACCOUNT_RETAINED_EARNINGS,
  type ResultDispositionPreview,
} from "../types/result-disposition.js";

// ── Types ───────────────────────────────────────────────────

export interface YearEndSummary {
  readonly fiscalYear: {
    readonly id: string;
    readonly startDate: Date;
    readonly endDate: Date;
    readonly isClosed: boolean;
  };
  readonly incomeStatement: IncomeStatement;
  readonly balanceSheet: BalanceSheet;
  /** Present only when the year is closed and has a non-zero result */
  readonly disposition: ResultDispositionPreview | null;
  /** Whether result disposition has already been executed (2099 balance is zero) */
  readonly isDisposed: boolean;
  readonly generatedAt: Date;
}

// ── Calculation ─────────────────────────────────────────────

/**
 * Calculate a complete year-end summary for a fiscal year.
 *
 * @param fiscalYear – the fiscal year to summarize
 * @param vouchers – all vouchers for the fiscal year
 * @param accounts – all accounts for the organization
 * @param targetFiscalYearId – optional ID for the target year (for disposition preview)
 */
export function calculateYearEndSummary(
  fiscalYear: FiscalYear,
  vouchers: readonly Voucher[],
  accounts: readonly Account[],
  targetFiscalYearId?: string,
): YearEndSummary {
  const incomeStatement = calculateIncomeStatement(vouchers, accounts);
  const balanceSheet = calculateBalanceSheet(vouchers, accounts);

  // Check if result has already been disposed (2099 balance is zero after closing)
  // For 2099 (equity): credit - debit = positive means profit still in account
  const account2099CreditBalance = calculateCreditBalance(vouchers, ACCOUNT_YEAR_RESULT);
  const isDisposed = fiscalYear.isClosed && account2099CreditBalance === 0;

  // Calculate disposition preview if year is closed and 2099 has a balance
  let disposition: ResultDispositionPreview | null = null;
  if (fiscalYear.isClosed && !isDisposed && targetFiscalYearId && account2099CreditBalance !== 0) {
    const dispResult = calculateResultDisposition(
      account2099CreditBalance,
      fiscalYear.id,
      targetFiscalYearId,
    );
    if (dispResult.ok) {
      disposition = dispResult.value;
    }
  }

  return {
    fiscalYear: {
      id: fiscalYear.id,
      startDate: fiscalYear.startDate,
      endDate: fiscalYear.endDate,
      isClosed: fiscalYear.isClosed,
    },
    incomeStatement,
    balanceSheet,
    disposition,
    isDisposed,
    generatedAt: new Date(),
  };
}

/**
 * Calculate the credit balance (credit - debit) of a specific account.
 * Positive = credit balance (used for equity accounts like 2099).
 */
function calculateCreditBalance(vouchers: readonly Voucher[], accountNumber: string): number {
  let balance = 0;
  for (const v of vouchers) {
    for (const line of v.lines) {
      if (line.accountNumber === accountNumber) {
        balance += line.credit - line.debit;
      }
    }
  }
  return balance;
}
