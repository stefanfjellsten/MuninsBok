/**
 * Budget — budgetera per konto och räkenskapsår, jämför utfall mot budget.
 *
 * Each budget belongs to an organization and a fiscal year.
 * Budget entries are per account + month (1–12), storing amounts in öre.
 */

// ── Domain types ────────────────────────────────────────────

export interface BudgetEntry {
  readonly id: string;
  readonly budgetId: string;
  readonly accountNumber: string;
  /** Month within the fiscal year (1 = first month, 12 = last month). */
  readonly month: number;
  /** Budgeted amount in öre. Positive = debit, negative = credit. */
  readonly amount: number;
}

export interface Budget {
  readonly id: string;
  readonly organizationId: string;
  readonly fiscalYearId: string;
  readonly name: string;
  readonly entries: readonly BudgetEntry[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ── Input types ─────────────────────────────────────────────

export interface CreateBudgetEntryInput {
  readonly accountNumber: string;
  /** Month within the fiscal year (1–12). */
  readonly month: number;
  /** Budgeted amount in öre. Positive = debit, negative = credit. */
  readonly amount: number;
}

export interface CreateBudgetInput {
  readonly fiscalYearId: string;
  readonly name: string;
  readonly entries: readonly CreateBudgetEntryInput[];
}

export interface UpdateBudgetInput {
  readonly name?: string;
  /** Replaces all entries entirely (simpler UX). */
  readonly entries?: readonly CreateBudgetEntryInput[];
}

// ── Error types ─────────────────────────────────────────────

export type BudgetErrorCode =
  | "NOT_FOUND"
  | "DUPLICATE_NAME"
  | "NO_ENTRIES"
  | "INVALID_ENTRY"
  | "NAME_REQUIRED"
  | "FISCAL_YEAR_NOT_FOUND";

export interface BudgetError {
  readonly code: BudgetErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

// ── Validation ──────────────────────────────────────────────

export interface BudgetEntryError {
  readonly code: "INVALID_ACCOUNT" | "INVALID_MONTH" | "ZERO_AMOUNT";
  readonly message: string;
}

/** Validate a single budget entry. */
export function validateBudgetEntry(entry: CreateBudgetEntryInput): BudgetEntryError | null {
  if (!/^[1-8]\d{3}$/.test(entry.accountNumber)) {
    return { code: "INVALID_ACCOUNT", message: "Ogiltigt kontonummer" };
  }
  if (entry.month < 1 || entry.month > 12 || !Number.isInteger(entry.month)) {
    return { code: "INVALID_MONTH", message: "Månad måste vara 1–12" };
  }
  if (entry.amount === 0) {
    return { code: "ZERO_AMOUNT", message: "Belopp får inte vara 0" };
  }
  return null;
}

/** Validate a full budget input. Returns list of errors (empty = valid). */
export function validateBudgetInput(input: CreateBudgetInput): BudgetEntryError[] {
  return input.entries.map(validateBudgetEntry).filter((e): e is BudgetEntryError => e !== null);
}
