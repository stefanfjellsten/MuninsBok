/**
 * Result Disposition (Resultatdisposition)
 *
 * After a fiscal year is closed, the year's result sits in account 2099
 * (Årets resultat). The result disposition transfers this balance to
 * account 2091 (Balanserat resultat / Retained earnings), typically
 * after an AGM decision (stämmobeslut).
 *
 * The disposition voucher is created in the target (new) fiscal year.
 */

import type { Result } from "./result.js";

// ── BAS account constants ───────────────────────────────────

/** Årets resultat – year's result account */
export const ACCOUNT_YEAR_RESULT = "2099";
/** Balanserat resultat – retained earnings account */
export const ACCOUNT_RETAINED_EARNINGS = "2091";

// ── Error types ─────────────────────────────────────────────

export type ResultDispositionErrorCode =
  | "NOT_FOUND"
  | "YEAR_NOT_CLOSED"
  | "ALREADY_DISPOSED"
  | "NO_RESULT"
  | "TARGET_YEAR_CLOSED"
  | "TARGET_YEAR_REQUIRED";

export interface ResultDispositionError {
  readonly code: ResultDispositionErrorCode;
  readonly message: string;
}

// ── Disposition preview ─────────────────────────────────────

export interface ResultDispositionLine {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
}

export interface ResultDispositionPreview {
  /** The closed fiscal year being disposed */
  readonly closedFiscalYearId: string;
  /** The target fiscal year where the disposition voucher will be created */
  readonly targetFiscalYearId: string;
  /** Net result from the closed year in öre (positive = profit) */
  readonly netResult: number;
  /** The voucher lines that will be created */
  readonly lines: readonly ResultDispositionLine[];
  /** Whether the disposition voucher would balance */
  readonly isBalanced: boolean;
  readonly generatedAt: Date;
}

// ── Input ───────────────────────────────────────────────────

export interface ExecuteResultDispositionInput {
  /** The closed fiscal year whose result to dispose */
  readonly closedFiscalYearId: string;
  /** The target fiscal year where the voucher should be created */
  readonly targetFiscalYearId: string;
  readonly organizationId: string;
}

// ── Validation ──────────────────────────────────────────────

/**
 * Calculate what a result disposition voucher would look like.
 *
 * @param netResult – year's result in öre (positive = profit, negative = loss)
 * @param closedFiscalYearId – the closed fiscal year ID
 * @param targetFiscalYearId – the target fiscal year ID
 * @returns Ok with preview, or Err if no result to dispose
 */
export function calculateResultDisposition(
  netResult: number,
  closedFiscalYearId: string,
  targetFiscalYearId: string,
): Result<ResultDispositionPreview, ResultDispositionError> {
  if (netResult === 0) {
    return {
      ok: false,
      error: {
        code: "NO_RESULT",
        message: "Inget resultat att disponera — årets resultat är noll",
      },
    };
  }

  const lines: ResultDispositionLine[] = [];

  if (netResult > 0) {
    // Profit: 2099 has credit balance after closing → debit 2099, credit 2091
    lines.push({
      accountNumber: ACCOUNT_YEAR_RESULT,
      accountName: "Årets resultat",
      debit: netResult,
      credit: 0,
    });
    lines.push({
      accountNumber: ACCOUNT_RETAINED_EARNINGS,
      accountName: "Balanserat resultat",
      debit: 0,
      credit: netResult,
    });
  } else {
    // Loss: 2099 has debit balance after closing → credit 2099, debit 2091
    const absResult = -netResult;
    lines.push({
      accountNumber: ACCOUNT_YEAR_RESULT,
      accountName: "Årets resultat",
      debit: 0,
      credit: absResult,
    });
    lines.push({
      accountNumber: ACCOUNT_RETAINED_EARNINGS,
      accountName: "Balanserat resultat",
      debit: absResult,
      credit: 0,
    });
  }

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

  return {
    ok: true,
    value: {
      closedFiscalYearId,
      targetFiscalYearId,
      netResult,
      lines,
      isBalanced: totalDebit === totalCredit,
      generatedAt: new Date(),
    },
  };
}
