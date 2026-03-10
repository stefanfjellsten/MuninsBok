import type { FastifyInstance, FastifyReply } from "fastify";
import type { Voucher, Account } from "@muninsbok/core/types";

/** Filter vouchers by optional date range */
export function filterByDateRange(
  vouchers: Voucher[],
  startDate?: string,
  endDate?: string,
): Voucher[] {
  if (!startDate && !endDate) return vouchers;
  return vouchers.filter((v) => {
    const d = v.date instanceof Date ? v.date : new Date(v.date);
    if (startDate && d < new Date(startDate)) return false;
    if (endDate && d > new Date(endDate)) return false;
    return true;
  });
}

export interface ReportRouteContext {
  vouchers: Voucher[];
  accounts: Account[];
}

/**
 * Common plumbing shared by every report endpoint:
 *   1. Validate that fiscalYearId was provided
 *   2. Fetch vouchers + accounts in parallel
 *   3. Apply optional date range filter
 *
 * Returns the filtered vouchers + accounts, or sends a 400
 * and returns `null` so the caller can short-circuit.
 */
export async function loadReportData(
  fastify: FastifyInstance,
  orgId: string,
  query: { fiscalYearId?: string; startDate?: string; endDate?: string },
  reply: FastifyReply,
): Promise<ReportRouteContext | null> {
  const { fiscalYearId, startDate, endDate } = query;

  if (!fiscalYearId) {
    reply.status(400).send({ error: "fiscalYearId krävs" });
    return null;
  }

  const [allVouchers, accounts] = await Promise.all([
    fastify.repos.vouchers.findByFiscalYear(fiscalYearId, orgId),
    fastify.repos.accounts.findByOrganization(orgId),
  ]);

  const vouchers = filterByDateRange(allVouchers, startDate, endDate);
  return { vouchers, accounts };
}
