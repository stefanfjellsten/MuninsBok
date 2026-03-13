import type { FastifyInstance } from "fastify";
import { öreToKronor } from "../utils/amount-conversion.js";

export async function searchRoutes(fastify: FastifyInstance) {
  const voucherRepo = fastify.repos.vouchers;
  const accountRepo = fastify.repos.accounts;

  fastify.get<{
    Params: { orgId: string };
    Querystring: { q: string; fiscalYearId: string };
  }>("/:orgId/search", async (request, reply) => {
    const { orgId } = request.params;
    const { q, fiscalYearId } = request.query;

    if (!q || q.trim().length === 0) {
      return reply.status(400).send({ error: "Sökterm (q) krävs" });
    }

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }

    const query = q.trim();

    // Search vouchers and accounts in parallel
    const [allVouchers, allAccounts] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
    ]);

    // Filter vouchers: match description (case-insensitive) or exact number
    const queryLower = query.toLowerCase();
    const queryNumber = /^\d+$/.test(query) ? parseInt(query, 10) : null;

    const matchedVouchers = allVouchers
      .filter(
        (v) =>
          v.description.toLowerCase().includes(queryLower) ||
          (queryNumber !== null && v.number === queryNumber),
      )
      .sort((a, b) => b.number - a.number)
      .slice(0, 20)
      .map((v) => ({
        id: v.id,
        number: v.number,
        date: v.date.toISOString(),
        description: v.description,
        amount: öreToKronor(v.lines.reduce((sum, l) => sum + l.debit, 0)),
      }));

    // Filter accounts: match name (case-insensitive) or number prefix
    const matchedAccounts = allAccounts
      .filter((a) => a.name.toLowerCase().includes(queryLower) || a.number.startsWith(query))
      .slice(0, 20)
      .map((a) => ({
        number: a.number,
        name: a.name,
        type: a.type,
      }));

    return {
      data: {
        query,
        vouchers: matchedVouchers,
        accounts: matchedAccounts,
        totalHits: matchedVouchers.length + matchedAccounts.length,
      },
    };
  });
}
