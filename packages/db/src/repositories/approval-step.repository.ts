import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  ApprovalStep,
  ApprovalDecisionInput,
  ApprovalError,
  IApprovalStepRepository,
} from "@muninsbok/core/types";
import { ok, err, type Result } from "@muninsbok/core/types";
import { toApprovalStep } from "../mappers.js";

export class ApprovalStepRepository implements IApprovalStepRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByVoucher(voucherId: string): Promise<ApprovalStep[]> {
    const steps = await this.prisma.approvalStep.findMany({
      where: { voucherId },
      orderBy: { stepOrder: "asc" },
    });
    return steps.map(toApprovalStep);
  }

  async findById(id: string): Promise<ApprovalStep | null> {
    const step = await this.prisma.approvalStep.findUnique({ where: { id } });
    return step ? toApprovalStep(step) : null;
  }

  async findPendingByOrganization(organizationId: string): Promise<ApprovalStep[]> {
    const steps = await this.prisma.approvalStep.findMany({
      where: {
        status: "PENDING",
        voucher: { organizationId },
      },
      orderBy: { createdAt: "asc" },
    });
    return steps.map(toApprovalStep);
  }

  async createMany(
    voucherId: string,
    steps: readonly { stepOrder: number; requiredRole: string }[],
  ): Promise<ApprovalStep[]> {
    // Create in a transaction so all steps are created atomically
    const created = await this.prisma.$transaction(
      steps.map((s) =>
        this.prisma.approvalStep.create({
          data: {
            voucherId,
            stepOrder: s.stepOrder,
            requiredRole: s.requiredRole as "OWNER" | "ADMIN" | "MEMBER",
          },
        }),
      ),
    );
    return created.map(toApprovalStep);
  }

  async decide(input: ApprovalDecisionInput): Promise<Result<ApprovalStep, ApprovalError>> {
    const step = await this.prisma.approvalStep.findUnique({
      where: { id: input.stepId },
    });

    if (!step) {
      return err({ code: "NOT_FOUND", message: "Atteststeget hittades inte" });
    }

    if (step.status !== "PENDING") {
      return err({ code: "ALREADY_DECIDED", message: "Steget har redan beslutats" });
    }

    const updated = await this.prisma.approvalStep.update({
      where: { id: input.stepId },
      data: {
        status: input.decision,
        approverUserId: input.userId,
        decidedAt: new Date(),
        ...(input.comment !== undefined && { comment: input.comment }),
      },
    });

    return ok(toApprovalStep(updated));
  }
}
