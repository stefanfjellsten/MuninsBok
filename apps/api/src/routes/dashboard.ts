import type { FastifyInstance } from "fastify";
import { calculateIncomeStatement } from "@muninsbok/core/reports";
import { öreToKronor } from "../utils/amount-conversion.js";
import type { Voucher, Account } from "@muninsbok/core/types";

/** Aggregate vouchers into a monthly map (öre values). */
function buildMonthlyMap(
  vouchers: Voucher[],
  accounts: Account[],
): Map<string, { count: number; income: number; expense: number }> {
  const map = new Map<string, { count: number; income: number; expense: number }>();
  for (const voucher of vouchers) {
    const key = `${voucher.date.getFullYear()}-${String(voucher.date.getMonth() + 1).padStart(2, "0")}`;
    let entry = map.get(key);
    if (!entry) {
      entry = { count: 0, income: 0, expense: 0 };
      map.set(key, entry);
    }
    entry.count += 1;
    for (const line of voucher.lines) {
      const acct = accounts.find((a) => a.number === line.accountNumber);
      if (acct?.type === "REVENUE") {
        entry.income += line.credit - line.debit;
      } else if (acct?.type === "EXPENSE") {
        entry.expense += line.debit - line.credit;
      }
    }
  }
  return map;
}

/** Simple linear regression forecast based on monthly data. */
function computeForecast(
  monthlyTrend: { month: string; income: number; expense: number }[],
  totalMonthsInYear: number,
): {
  projectedIncome: number;
  projectedExpense: number;
  projectedYearEndResult: number;
  dataPoints: number;
} | null {
  if (monthlyTrend.length < 2) return null;

  const n = monthlyTrend.length;
  // Linear regression on income and expense
  let sumX = 0,
    sumI = 0,
    sumE = 0,
    sumXI = 0,
    sumXE = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    const trend = monthlyTrend[i] ?? { income: 0, expense: 0 };
    sumI += trend.income;
    sumE += trend.expense;
    sumXI += i * trend.income;
    sumXE += i * trend.expense;
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slopeI = (n * sumXI - sumX * sumI) / denom;
  const interceptI = (sumI - slopeI * sumX) / n;
  const slopeE = (n * sumXE - sumX * sumE) / denom;
  const interceptE = (sumE - slopeE * sumX) / n;

  // Project remaining months
  let projectedTotalIncome = sumI;
  let projectedTotalExpense = sumE;
  for (let i = n; i < totalMonthsInYear; i++) {
    projectedTotalIncome += Math.max(0, interceptI + slopeI * i);
    projectedTotalExpense += Math.max(0, interceptE + slopeE * i);
  }

  // Next month projection
  const projectedIncome = Math.max(0, Math.round(interceptI + slopeI * n));
  const projectedExpense = Math.max(0, Math.round(interceptE + slopeE * n));

  return {
    projectedIncome,
    projectedExpense,
    projectedYearEndResult: Math.round(projectedTotalIncome - projectedTotalExpense),
    dataPoints: n,
  };
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  const voucherRepo = fastify.repos.vouchers;
  const accountRepo = fastify.repos.accounts;
  const fiscalYearRepo = fastify.repos.fiscalYears;

  fastify.get<{
    Params: { orgId: string };
    Querystring: { fiscalYearId: string };
  }>("/:orgId/dashboard", async (request, reply) => {
    const { orgId } = request.params;
    const { fiscalYearId } = request.query;

    if (!fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }

    const [vouchers, accounts, currentFy] = await Promise.all([
      voucherRepo.findByFiscalYear(fiscalYearId, orgId),
      accountRepo.findByOrganization(orgId),
      fiscalYearRepo.findById(fiscalYearId, orgId),
    ]);

    // Income statement for net result
    const incomeStatement = calculateIncomeStatement(vouchers, accounts);

    // Latest 5 vouchers (sorted by number desc)
    const latestVouchers = [...vouchers]
      .sort((a, b) => b.number - a.number)
      .slice(0, 5)
      .map((v) => ({
        id: v.id,
        number: v.number,
        date: v.date.toISOString(),
        description: v.description,
        amount: öreToKronor(v.lines.reduce((sum, l) => sum + l.debit, 0)),
      }));

    // Balance check — total debit should equal total credit
    let totalDebit = 0;
    let totalCredit = 0;
    for (const voucher of vouchers) {
      for (const line of voucher.lines) {
        totalDebit += line.debit;
        totalCredit += line.credit;
      }
    }

    // Account distribution
    const accountTypeCounts: Record<string, number> = {};
    for (const account of accounts) {
      accountTypeCounts[account.type] = (accountTypeCounts[account.type] ?? 0) + 1;
    }

    // Monthly aggregation for current year
    const monthlyMap = buildMonthlyMap(vouchers, accounts);
    const monthlyTrend = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        voucherCount: data.count,
        income: öreToKronor(data.income),
        expense: öreToKronor(data.expense),
      }));

    // --- Year comparison & forecast ---
    let yearComparison: {
      month: string;
      currentIncome: number;
      currentExpense: number;
      previousIncome: number;
      previousExpense: number;
    }[] = [];
    let previousYearResult: number | null = null;
    let forecast: {
      projectedIncome: number;
      projectedExpense: number;
      projectedYearEndResult: number;
      dataPoints: number;
    } | null = null;

    if (currentFy) {
      // Load previous fiscal year
      const previousFy = await fiscalYearRepo.findPreviousByDate(orgId, currentFy.startDate);
      if (previousFy) {
        const prevVouchers = await voucherRepo.findByFiscalYear(previousFy.id, orgId);
        const prevIncomeStatement = calculateIncomeStatement(prevVouchers, accounts);
        previousYearResult = öreToKronor(prevIncomeStatement.netResult);

        // Build previous year monthly map
        const prevMonthlyMap = buildMonthlyMap(prevVouchers, accounts);

        // Align months: use 01..12 keys for comparison
        const allMonthKeys = new Set<string>();
        for (const key of monthlyMap.keys()) {
          const mm = key.split("-")[1] ?? "";
          if (mm) allMonthKeys.add(mm);
        }
        for (const key of prevMonthlyMap.keys()) {
          const mm = key.split("-")[1] ?? "";
          if (mm) allMonthKeys.add(mm);
        }

        const sortedMonths = [...allMonthKeys].sort();
        yearComparison = sortedMonths.map((mm) => {
          const currKey = [...monthlyMap.keys()].find((k) => k.endsWith(`-${mm}`));
          const prevKey = [...prevMonthlyMap.keys()].find((k) => k.endsWith(`-${mm}`));
          const curr = currKey
            ? (monthlyMap.get(currKey) ?? { income: 0, expense: 0 })
            : { income: 0, expense: 0 };
          const prev = prevKey
            ? (prevMonthlyMap.get(prevKey) ?? { income: 0, expense: 0 })
            : { income: 0, expense: 0 };
          return {
            month: mm,
            currentIncome: öreToKronor(curr.income),
            currentExpense: öreToKronor(curr.expense),
            previousIncome: öreToKronor(prev.income),
            previousExpense: öreToKronor(prev.expense),
          };
        });
      }

      // Forecast based on current year trend (kronor values)
      const totalMonths = Math.round(
        (currentFy.endDate.getTime() - currentFy.startDate.getTime()) /
          (30.44 * 24 * 60 * 60 * 1000),
      );
      forecast = computeForecast(monthlyTrend, Math.max(totalMonths, monthlyTrend.length));
    }

    return {
      data: {
        voucherCount: vouchers.length,
        accountCount: accounts.length,
        netResult: öreToKronor(incomeStatement.netResult),
        totalDebit: öreToKronor(totalDebit),
        totalCredit: öreToKronor(totalCredit),
        isBalanced: totalDebit === totalCredit,
        latestVouchers,
        accountTypeCounts,
        monthlyTrend,
        yearComparison,
        previousYearResult,
        forecast,
        generatedAt: new Date().toISOString(),
      },
    };
  });
}
