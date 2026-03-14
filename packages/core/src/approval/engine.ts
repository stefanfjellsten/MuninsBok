/**
 * Approval engine — pure business logic for the voucher approval workflow.
 *
 * Determines which approval steps are required for a voucher, validates
 * whether a user is authorized to approve a step, and computes the new
 * voucher status after a decision.
 */

import type {
  ApprovalRule,
  ApprovalStep,
  ApprovalStepStatus,
  VoucherStatus,
} from "../types/approval.js";
import type { MemberRole } from "../types/user.js";
import type { CreateVoucherLineInput } from "../types/voucher-line.js";

/** Role hierarchy for authorization — higher index = higher authority. */
const ROLE_HIERARCHY: readonly MemberRole[] = ["MEMBER", "ADMIN", "OWNER"];

function roleLevel(role: MemberRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Filter approval rules that apply to a given voucher amount.
 * @param rules All rules for the organization (sorted by stepOrder)
 * @param totalAmount Total voucher amount in öre (max of debit/credit)
 */
export function findApplicableRules(
  rules: readonly ApprovalRule[],
  totalAmount: number,
): ApprovalRule[] {
  return rules
    .filter(
      (r) => totalAmount >= r.minAmount && (r.maxAmount === null || totalAmount <= r.maxAmount),
    )
    .sort((a, b) => a.stepOrder - b.stepOrder);
}

/**
 * Calculate the total amount for a set of voucher lines (max of debit / credit sums).
 */
export function calculateVoucherTotal(lines: readonly CreateVoucherLineInput[]): number {
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  return Math.max(totalDebit, totalCredit);
}

/**
 * Determine whether a user with a given role can approve a specific step.
 *
 * A user may approve if their role is >= the required role in the hierarchy.
 * Already-decided steps cannot be approved again.
 */
export function canUserApproveStep(step: ApprovalStep, userRole: MemberRole): boolean {
  if (step.status !== "PENDING") return false;
  return roleLevel(userRole) >= roleLevel(step.requiredRole);
}

/**
 * Check if a step is the next in line to be decided (all lower-order steps are approved).
 */
export function isNextPendingStep(step: ApprovalStep, allSteps: readonly ApprovalStep[]): boolean {
  if (step.status !== "PENDING") return false;
  const pendingSteps = allSteps
    .filter((s) => s.status === "PENDING")
    .sort((a, b) => a.stepOrder - b.stepOrder);
  const first = pendingSteps[0];
  return first !== undefined && first.id === step.id;
}

/**
 * After a decision is made on a step, compute the new voucher status.
 *
 * - If any step is REJECTED → REJECTED
 * - If all steps are APPROVED → APPROVED
 * - Otherwise → PENDING (still waiting for remaining steps)
 */
export function computeVoucherStatus(steps: readonly ApprovalStep[]): VoucherStatus {
  if (steps.length === 0) return "DRAFT";
  if (steps.some((s) => s.status === "REJECTED")) return "REJECTED";
  if (steps.every((s) => s.status === "APPROVED")) return "APPROVED";
  return "PENDING";
}

/**
 * Check if a voucher needs approval based on the organization's rules.
 * Returns true if there are matching rules for the voucher amount.
 */
export function requiresApproval(rules: readonly ApprovalRule[], totalAmount: number): boolean {
  return findApplicableRules(rules, totalAmount).length > 0;
}

/**
 * Build the step definitions needed when a voucher is submitted for approval.
 */
export function buildApprovalSteps(
  rules: readonly ApprovalRule[],
  totalAmount: number,
): { stepOrder: number; requiredRole: MemberRole }[] {
  return findApplicableRules(rules, totalAmount).map((r) => ({
    stepOrder: r.stepOrder,
    requiredRole: r.requiredRole,
  }));
}
