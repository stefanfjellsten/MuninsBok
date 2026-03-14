import { describe, it, expect } from "vitest";
import {
  findApplicableRules,
  calculateVoucherTotal,
  canUserApproveStep,
  isNextPendingStep,
  computeVoucherStatus,
  requiresApproval,
  buildApprovalSteps,
} from "./engine.js";
import type { ApprovalRule, ApprovalStep } from "../types/approval.js";

function makeRule(overrides: Partial<ApprovalRule> = {}): ApprovalRule {
  return {
    id: "rule-1",
    organizationId: "org-1",
    name: "Default",
    minAmount: 0,
    maxAmount: null,
    requiredRole: "ADMIN",
    stepOrder: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeStep(overrides: Partial<ApprovalStep> = {}): ApprovalStep {
  return {
    id: "step-1",
    voucherId: "v-1",
    stepOrder: 1,
    requiredRole: "ADMIN",
    approverUserId: null,
    status: "PENDING",
    comment: null,
    decidedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("findApplicableRules", () => {
  it("returns rules matching the amount", () => {
    const rules = [
      makeRule({ id: "r1", minAmount: 0, maxAmount: 10000, stepOrder: 1 }),
      makeRule({ id: "r2", minAmount: 10001, maxAmount: 50000, stepOrder: 2 }),
      makeRule({ id: "r3", minAmount: 50001, maxAmount: null, stepOrder: 3 }),
    ];
    expect(findApplicableRules(rules, 5000).map((r) => r.id)).toEqual(["r1"]);
    expect(findApplicableRules(rules, 10000).map((r) => r.id)).toEqual(["r1"]);
    expect(findApplicableRules(rules, 10001).map((r) => r.id)).toEqual(["r2"]);
    expect(findApplicableRules(rules, 100000).map((r) => r.id)).toEqual(["r3"]);
  });

  it("returns multiple rules when amount ranges overlap", () => {
    const rules = [
      makeRule({ id: "r1", minAmount: 0, maxAmount: null, stepOrder: 1, requiredRole: "ADMIN" }),
      makeRule({
        id: "r2",
        minAmount: 50000,
        maxAmount: null,
        stepOrder: 2,
        requiredRole: "OWNER",
      }),
    ];
    expect(findApplicableRules(rules, 60000).map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("returns empty if no rules match", () => {
    const rules = [makeRule({ minAmount: 10000, maxAmount: 50000 })];
    expect(findApplicableRules(rules, 5000)).toEqual([]);
  });

  it("sorts by stepOrder", () => {
    const rules = [
      makeRule({ id: "r2", minAmount: 0, maxAmount: null, stepOrder: 2 }),
      makeRule({ id: "r1", minAmount: 0, maxAmount: null, stepOrder: 1 }),
    ];
    expect(findApplicableRules(rules, 100).map((r) => r.id)).toEqual(["r1", "r2"]);
  });
});

describe("calculateVoucherTotal", () => {
  it("returns max of total debit and total credit", () => {
    const lines = [
      { accountNumber: "1910", debit: 10000, credit: 0 },
      { accountNumber: "3010", debit: 0, credit: 10000 },
    ];
    expect(calculateVoucherTotal(lines)).toBe(10000);
  });

  it("returns 0 for empty lines", () => {
    expect(calculateVoucherTotal([])).toBe(0);
  });
});

describe("canUserApproveStep", () => {
  it("allows ADMIN to approve ADMIN-required step", () => {
    const step = makeStep({ requiredRole: "ADMIN" });
    expect(canUserApproveStep(step, "ADMIN")).toBe(true);
  });

  it("allows OWNER to approve ADMIN-required step", () => {
    const step = makeStep({ requiredRole: "ADMIN" });
    expect(canUserApproveStep(step, "OWNER")).toBe(true);
  });

  it("denies MEMBER from approving ADMIN-required step", () => {
    const step = makeStep({ requiredRole: "ADMIN" });
    expect(canUserApproveStep(step, "MEMBER")).toBe(false);
  });

  it("denies if step is already decided", () => {
    const step = makeStep({ status: "APPROVED" });
    expect(canUserApproveStep(step, "OWNER")).toBe(false);
  });
});

describe("isNextPendingStep", () => {
  it("returns true for the lowest-order pending step", () => {
    const s1 = makeStep({ id: "s1", stepOrder: 1, status: "APPROVED" });
    const s2 = makeStep({ id: "s2", stepOrder: 2, status: "PENDING" });
    const s3 = makeStep({ id: "s3", stepOrder: 3, status: "PENDING" });
    const steps = [s1, s2, s3];
    expect(isNextPendingStep(s2, steps)).toBe(true);
    expect(isNextPendingStep(s3, steps)).toBe(false);
  });

  it("returns false for non-pending step", () => {
    const step = makeStep({ status: "APPROVED" });
    expect(isNextPendingStep(step, [step])).toBe(false);
  });
});

describe("computeVoucherStatus", () => {
  it("returns DRAFT for no steps", () => {
    expect(computeVoucherStatus([])).toBe("DRAFT");
  });

  it("returns APPROVED when all steps approved", () => {
    const steps = [makeStep({ status: "APPROVED" }), makeStep({ id: "s2", status: "APPROVED" })];
    expect(computeVoucherStatus(steps)).toBe("APPROVED");
  });

  it("returns REJECTED if any step rejected", () => {
    const steps = [makeStep({ status: "APPROVED" }), makeStep({ id: "s2", status: "REJECTED" })];
    expect(computeVoucherStatus(steps)).toBe("REJECTED");
  });

  it("returns PENDING while steps remain", () => {
    const steps = [makeStep({ status: "APPROVED" }), makeStep({ id: "s2", status: "PENDING" })];
    expect(computeVoucherStatus(steps)).toBe("PENDING");
  });
});

describe("requiresApproval", () => {
  it("returns true when matching rules exist", () => {
    const rules = [makeRule({ minAmount: 0, maxAmount: null })];
    expect(requiresApproval(rules, 100)).toBe(true);
  });

  it("returns false when no matching rules", () => {
    const rules = [makeRule({ minAmount: 10000, maxAmount: 50000 })];
    expect(requiresApproval(rules, 5000)).toBe(false);
  });

  it("returns false when no rules at all", () => {
    expect(requiresApproval([], 100)).toBe(false);
  });
});

describe("buildApprovalSteps", () => {
  it("builds step definitions from matching rules", () => {
    const rules = [
      makeRule({ minAmount: 0, maxAmount: null, stepOrder: 1, requiredRole: "ADMIN" }),
      makeRule({
        id: "r2",
        minAmount: 50000,
        maxAmount: null,
        stepOrder: 2,
        requiredRole: "OWNER",
      }),
    ];
    const steps = buildApprovalSteps(rules, 60000);
    expect(steps).toEqual([
      { stepOrder: 1, requiredRole: "ADMIN" },
      { stepOrder: 2, requiredRole: "OWNER" },
    ]);
  });

  it("returns empty array when no rules match", () => {
    const rules = [makeRule({ minAmount: 100000, maxAmount: null })];
    expect(buildApprovalSteps(rules, 5000)).toEqual([]);
  });
});
