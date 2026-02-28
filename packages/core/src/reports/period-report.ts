import type { Account } from "../types/account.js";
import type { Voucher } from "../types/voucher.js";

/**
 * Period Report (Periodrapport)
 *
 * Breaks down an income statement into monthly or quarterly periods,
 * giving a clear view of how income / expenses evolve over time.
 *
 * All monetary amounts are in öre (integer cents).
 */

// ── Types ───────────────────────────────────────────────────

export type PeriodType = "month" | "quarter";

export interface PeriodRow {
  /** Human-readable label, e.g. "2024-01" or "2024 Q1" */
  readonly label: string;
  /** ISO start date of the period (inclusive) */
  readonly startDate: string;
  /** ISO end date of the period (inclusive) */
  readonly endDate: string;
  /** Total revenue (intäkter) in the period – öre */
  readonly income: number;
  /** Total expenses (kostnader) in the period – öre (positive = cost) */
  readonly expenses: number;
  /** income − expenses – öre */
  readonly result: number;
  /** Cumulative result from the first period up to and including this one – öre */
  readonly cumulativeResult: number;
}

export interface PeriodReport {
  readonly periodType: PeriodType;
  readonly periods: readonly PeriodRow[];
  /** Grand totals across all periods */
  readonly totalIncome: number;
  readonly totalExpenses: number;
  readonly totalResult: number;
  readonly generatedAt: Date;
}

// ── Account classification helpers ──────────────────────────

/** Revenue accounts: 3000–3999 */
function isRevenue(num: number): boolean {
  return num >= 3000 && num <= 3999;
}

/** Expense accounts: 4000–8999 (includes financial) */
function isExpense(num: number): boolean {
  return num >= 4000 && num <= 8999;
}

// ── Period key helpers ──────────────────────────────────────

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function quarterKey(date: Date): string {
  const y = date.getFullYear();
  const q = Math.ceil((date.getMonth() + 1) / 3);
  return `${y} Q${q}`;
}

function periodKeyFn(periodType: PeriodType): (date: Date) => string {
  return periodType === "month" ? monthKey : quarterKey;
}

// ── Period date ranges ──────────────────────────────────────

interface PeriodMeta {
  label: string;
  startDate: string;
  endDate: string;
}

/** Return the last day of a given month (1-indexed). */
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Generate an ordered list of all period slots that span the fiscal year,
 * including periods with no voucher activity (they'll show zero).
 */
function generatePeriodSlots(vouchers: readonly Voucher[], periodType: PeriodType): PeriodMeta[] {
  if (vouchers.length === 0) return [];

  // Find min and max dates
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const first = vouchers[0]!;
  let minDate = new Date(first.date);
  let maxDate = new Date(first.date);
  for (const v of vouchers) {
    const d = v.date instanceof Date ? v.date : new Date(v.date);
    if (d < minDate) minDate = d;
    if (d > maxDate) maxDate = d;
  }

  const slots: PeriodMeta[] = [];

  if (periodType === "month") {
    let y = minDate.getFullYear();
    let m = minDate.getMonth(); // 0-indexed
    const endY = maxDate.getFullYear();
    const endM = maxDate.getMonth();

    while (y < endY || (y === endY && m <= endM)) {
      const label = `${y}-${String(m + 1).padStart(2, "0")}`;
      const last = lastDayOfMonth(y, m + 1);
      slots.push({
        label,
        startDate: `${y}-${String(m + 1).padStart(2, "0")}-01`,
        endDate: `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
      });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
  } else {
    // Quarters
    let y = minDate.getFullYear();
    let q = Math.ceil((minDate.getMonth() + 1) / 3);
    const endY = maxDate.getFullYear();
    const endQ = Math.ceil((maxDate.getMonth() + 1) / 3);

    while (y < endY || (y === endY && q <= endQ)) {
      const label = `${y} Q${q}`;
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = q * 3;
      const last = lastDayOfMonth(y, endMonth);
      slots.push({
        label,
        startDate: `${y}-${String(startMonth).padStart(2, "0")}-01`,
        endDate: `${y}-${String(endMonth).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
      });
      q++;
      if (q > 4) {
        q = 1;
        y++;
      }
    }
  }

  return slots;
}

// ── Main calculation ────────────────────────────────────────

/**
 * Calculate a period report from vouchers + accounts.
 *
 * @param vouchers – already filtered to the desired fiscal year / date range
 * @param _accounts – account list (for future per-account breakdowns)
 * @param periodType – "month" or "quarter"
 */
export function calculatePeriodReport(
  vouchers: readonly Voucher[],
  _accounts: readonly Account[],
  periodType: PeriodType = "month",
): PeriodReport {
  const getKey = periodKeyFn(periodType);

  // Accumulate income / expense per period key
  const incomeByPeriod = new Map<string, number>();
  const expenseByPeriod = new Map<string, number>();

  for (const voucher of vouchers) {
    const d = voucher.date instanceof Date ? voucher.date : new Date(voucher.date);
    const key = getKey(d);

    for (const line of voucher.lines) {
      const acctNum = parseInt(line.accountNumber, 10);

      if (isRevenue(acctNum)) {
        // Revenue: credit – debit (natural balance)
        const net = line.credit - line.debit;
        incomeByPeriod.set(key, (incomeByPeriod.get(key) ?? 0) + net);
      } else if (isExpense(acctNum)) {
        // Expense: debit – credit (natural balance for costs, shown positive)
        const net = line.debit - line.credit;
        expenseByPeriod.set(key, (expenseByPeriod.get(key) ?? 0) + net);
      }
    }
  }

  // Build period slots (including zero-activity months/quarters)
  const slots = generatePeriodSlots(vouchers, periodType);

  let cumulativeResult = 0;
  const periods: PeriodRow[] = slots.map((slot) => {
    const income = incomeByPeriod.get(slot.label) ?? 0;
    const expenses = expenseByPeriod.get(slot.label) ?? 0;
    const result = income - expenses;
    cumulativeResult += result;

    return {
      label: slot.label,
      startDate: slot.startDate,
      endDate: slot.endDate,
      income,
      expenses,
      result,
      cumulativeResult,
    };
  });

  const totalIncome = periods.reduce((s, p) => s + p.income, 0);
  const totalExpenses = periods.reduce((s, p) => s + p.expenses, 0);
  const totalResult = totalIncome - totalExpenses;

  return {
    periodType,
    periods,
    totalIncome,
    totalExpenses,
    totalResult,
    generatedAt: new Date(),
  };
}
