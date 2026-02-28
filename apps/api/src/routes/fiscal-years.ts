import type { FastifyInstance } from "fastify";
import { calculateClosingPreview } from "@muninsbok/core/reports";
import type { ClosingPreviewResponse } from "@muninsbok/core/api-types";
import { createFiscalYearSchema, openingBalancesSchema } from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";
import { öreToKronor } from "../utils/amount-conversion.js";

export async function fiscalYearRoutes(fastify: FastifyInstance) {
  const fyRepo = fastify.repos.fiscalYears;

  // List fiscal years for organization
  fastify.get<{ Params: { orgId: string } }>("/:orgId/fiscal-years", async (request) => {
    const fiscalYears = await fyRepo.findByOrganization(request.params.orgId);
    return { data: fiscalYears };
  });

  // Get single fiscal year
  fastify.get<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId",
    async (request, reply) => {
      const fy = await fyRepo.findById(request.params.fyId, request.params.orgId);
      if (!fy) {
        return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
      }
      return { data: fy };
    },
  );

  // Create fiscal year
  fastify.post<{ Params: { orgId: string } }>("/:orgId/fiscal-years", async (request, reply) => {
    const data = parseBody(createFiscalYearSchema, request.body);

    const result = await fyRepo.create({
      organizationId: request.params.orgId,
      startDate: data.startDate,
      endDate: data.endDate,
    });

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });

  // Close fiscal year (creates closing voucher + marks as closed)
  fastify.patch<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId/close",
    async (request, reply) => {
      const result = await fyRepo.close(request.params.fyId, request.params.orgId);

      if (!result.ok) {
        if (result.error.code === "NOT_FOUND") {
          return reply.status(404).send({ error: result.error });
        }
        return reply.status(400).send({ error: result.error });
      }

      return { data: result.value };
    },
  );

  // Create opening balances from previous fiscal year
  fastify.post<{
    Params: { orgId: string; fyId: string };
    Body: { previousFiscalYearId: string };
  }>("/:orgId/fiscal-years/:fyId/opening-balances", async (request, reply) => {
    const data = parseBody(openingBalancesSchema, request.body);

    const result = await fyRepo.createOpeningBalances(
      request.params.fyId,
      data.previousFiscalYearId,
      request.params.orgId,
    );

    if (!result.ok) {
      if (result.error.code === "NOT_FOUND") {
        return reply.status(404).send({ error: result.error });
      }
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });

  // Preview closing entries for a fiscal year (before actually closing)
  fastify.get<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId/close-preview",
    async (request, reply) => {
      const { orgId, fyId } = request.params;

      // Validate fiscal year exists
      const fy = await fyRepo.findById(fyId, orgId);
      if (!fy) {
        return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
      }
      if (fy.isClosed) {
        return reply.status(400).send({ error: "Räkenskapsåret är redan stängt" });
      }

      // Load vouchers and accounts
      const [vouchers, accounts] = await Promise.all([
        fastify.repos.vouchers.findByFiscalYear(fyId, orgId),
        fastify.repos.accounts.findByOrganization(orgId),
      ]);

      const preview = calculateClosingPreview(vouchers, accounts);

      // Convert öre → kronor
      function convertSection(s: typeof preview.revenues): ClosingPreviewResponse["revenues"] {
        return {
          title: s.title,
          lines: s.lines.map((l) => ({
            accountNumber: l.accountNumber,
            accountName: l.accountName,
            currentBalance: öreToKronor(l.currentBalance),
            closingDebit: öreToKronor(l.closingDebit),
            closingCredit: öreToKronor(l.closingCredit),
          })),
          total: öreToKronor(s.total),
        };
      }

      const response: ClosingPreviewResponse = {
        revenues: convertSection(preview.revenues),
        expenses: convertSection(preview.expenses),
        financialIncome: convertSection(preview.financialIncome),
        financialExpenses: convertSection(preview.financialExpenses),
        resultEntry: {
          accountNumber: preview.resultEntry.accountNumber,
          accountName: preview.resultEntry.accountName,
          debit: öreToKronor(preview.resultEntry.debit),
          credit: öreToKronor(preview.resultEntry.credit),
        },
        totalRevenues: öreToKronor(preview.totalRevenues),
        totalExpenses: öreToKronor(preview.totalExpenses),
        operatingResult: öreToKronor(preview.operatingResult),
        totalFinancialIncome: öreToKronor(preview.totalFinancialIncome),
        totalFinancialExpenses: öreToKronor(preview.totalFinancialExpenses),
        netResult: öreToKronor(preview.netResult),
        accountCount: preview.accountCount,
        isBalanced: preview.isBalanced,
        hasEntries: preview.hasEntries,
        generatedAt: preview.generatedAt.toISOString(),
      };

      return { data: response };
    },
  );
}
