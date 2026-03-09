import type { FastifyInstance } from "fastify";
import { calculateClosingPreview } from "@muninsbok/core/reports";
import { calculateYearEndSummary } from "@muninsbok/core/reports";
import type {
  ClosingPreviewResponse,
  ResultDispositionPreviewResponse,
  YearEndSummaryResponse,
} from "@muninsbok/core/api-types";
import {
  createFiscalYearSchema,
  openingBalancesSchema,
  resultDispositionSchema,
} from "../schemas/index.js";
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

  // Preview result disposition for a closed fiscal year
  fastify.get<{ Params: { orgId: string; fyId: string }; Querystring: { targetFyId?: string } }>(
    "/:orgId/fiscal-years/:fyId/disposition-preview",
    async (request, reply) => {
      const { orgId, fyId } = request.params;
      const targetFyId = (request.query as Record<string, string | undefined>)["targetFyId"];

      const fy = await fyRepo.findById(fyId, orgId);
      if (!fy) {
        return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
      }
      if (!fy.isClosed) {
        return reply.status(400).send({ error: "Räkenskapsåret måste vara stängt" });
      }

      // Load vouchers and accounts to calculate disposition
      const [vouchers, accounts] = await Promise.all([
        fastify.repos.vouchers.findByFiscalYear(fyId, orgId),
        fastify.repos.accounts.findByOrganization(orgId),
      ]);

      const summary = calculateYearEndSummary(fy, vouchers, accounts, targetFyId);

      if (!summary.disposition) {
        if (summary.isDisposed) {
          return reply.status(400).send({ error: "Resultatet har redan disponerats" });
        }
        return reply.status(400).send({ error: "Inget resultat att disponera" });
      }

      const disp = summary.disposition;
      const response: ResultDispositionPreviewResponse = {
        closedFiscalYearId: disp.closedFiscalYearId,
        targetFiscalYearId: disp.targetFiscalYearId,
        netResult: öreToKronor(disp.netResult),
        lines: disp.lines.map((l) => ({
          accountNumber: l.accountNumber,
          accountName: l.accountName,
          debit: öreToKronor(l.debit),
          credit: öreToKronor(l.credit),
        })),
        isBalanced: disp.isBalanced,
        generatedAt: disp.generatedAt.toISOString(),
      };

      return { data: response };
    },
  );

  // Execute result disposition (create voucher transferring 2099 → 2091)
  fastify.post<{ Params: { orgId: string; fyId: string } }>(
    "/:orgId/fiscal-years/:fyId/disposition",
    async (request, reply) => {
      const { orgId, fyId } = request.params;
      const data = parseBody(resultDispositionSchema, request.body);

      const result = await fyRepo.executeResultDisposition({
        closedFiscalYearId: data.closedFiscalYearId,
        targetFiscalYearId: fyId,
        organizationId: orgId,
      });

      if (!result.ok) {
        const status =
          result.error.code === "NOT_FOUND" || result.error.code === "TARGET_YEAR_REQUIRED"
            ? 404
            : 400;
        return reply.status(status).send({ error: result.error });
      }

      return reply.status(201).send({ data: result.value });
    },
  );

  // Year-end summary for a fiscal year
  fastify.get<{ Params: { orgId: string; fyId: string }; Querystring: { targetFyId?: string } }>(
    "/:orgId/fiscal-years/:fyId/year-end-summary",
    async (request, reply) => {
      const { orgId, fyId } = request.params;
      const targetFyId = (request.query as Record<string, string | undefined>)["targetFyId"];

      const fy = await fyRepo.findById(fyId, orgId);
      if (!fy) {
        return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
      }

      const [vouchers, accounts] = await Promise.all([
        fastify.repos.vouchers.findByFiscalYear(fyId, orgId),
        fastify.repos.accounts.findByOrganization(orgId),
      ]);

      const summary = calculateYearEndSummary(fy, vouchers, accounts, targetFyId);

      // Convert öre → kronor for the response
      function convertReportSection(s: {
        title: string;
        rows: readonly { accountNumber: string; accountName: string; amount: number }[];
        total: number;
      }) {
        return {
          title: s.title,
          rows: s.rows.map((r) => ({
            accountNumber: r.accountNumber,
            accountName: r.accountName,
            amount: öreToKronor(r.amount),
          })),
          total: öreToKronor(s.total),
        };
      }

      function convertBalanceSection(s: {
        title: string;
        rows: readonly { accountNumber: string; accountName: string; balance: number }[];
        total: number;
      }) {
        return {
          title: s.title,
          rows: s.rows.map((r) => ({
            accountNumber: r.accountNumber,
            accountName: r.accountName,
            amount: öreToKronor(r.balance),
          })),
          total: öreToKronor(s.total),
        };
      }

      const is = summary.incomeStatement;
      const bs = summary.balanceSheet;

      const dispositionResponse: ResultDispositionPreviewResponse | null = summary.disposition
        ? {
            closedFiscalYearId: summary.disposition.closedFiscalYearId,
            targetFiscalYearId: summary.disposition.targetFiscalYearId,
            netResult: öreToKronor(summary.disposition.netResult),
            lines: summary.disposition.lines.map((l) => ({
              accountNumber: l.accountNumber,
              accountName: l.accountName,
              debit: öreToKronor(l.debit),
              credit: öreToKronor(l.credit),
            })),
            isBalanced: summary.disposition.isBalanced,
            generatedAt: summary.disposition.generatedAt.toISOString(),
          }
        : null;

      const response: YearEndSummaryResponse = {
        fiscalYear: {
          id: summary.fiscalYear.id,
          startDate: summary.fiscalYear.startDate.toISOString(),
          endDate: summary.fiscalYear.endDate.toISOString(),
          isClosed: summary.fiscalYear.isClosed,
        },
        incomeStatement: {
          revenues: convertReportSection(is.revenues),
          expenses: convertReportSection(is.expenses),
          operatingResult: öreToKronor(is.operatingResult),
          financialIncome: convertReportSection(is.financialIncome),
          financialExpenses: convertReportSection(is.financialExpenses),
          netResult: öreToKronor(is.netResult),
          generatedAt: is.generatedAt.toISOString(),
        },
        balanceSheet: {
          assets: convertBalanceSection(bs.assets),
          liabilities: convertBalanceSection(bs.liabilities),
          equity: convertBalanceSection(bs.equity),
          totalAssets: öreToKronor(bs.totalAssets),
          totalLiabilitiesAndEquity: öreToKronor(bs.totalLiabilitiesAndEquity),
          difference: öreToKronor(bs.difference),
          yearResult: öreToKronor(bs.yearResult),
          generatedAt: bs.generatedAt.toISOString(),
        },
        disposition: dispositionResponse,
        isDisposed: summary.isDisposed,
        generatedAt: summary.generatedAt.toISOString(),
      };

      return { data: response };
    },
  );
}
