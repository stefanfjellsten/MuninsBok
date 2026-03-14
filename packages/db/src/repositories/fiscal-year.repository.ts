import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  FiscalYear,
  CreateFiscalYearInput,
  FiscalYearError,
  Voucher,
  IFiscalYearRepository,
  ExecuteResultDispositionInput,
  ResultDispositionError,
} from "@muninsbok/core/types";
import { ok, err, type Result } from "@muninsbok/core/types";
import { ACCOUNT_YEAR_RESULT, ACCOUNT_RETAINED_EARNINGS } from "@muninsbok/core/types";
import { toFiscalYear, toVoucher } from "../mappers.js";

const voucherInclude = {
  lines: true,
  documents: true,
  correctedByVoucher: true,
  approvalSteps: true,
} as const;

export class FiscalYearRepository implements IFiscalYearRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByOrganization(organizationId: string): Promise<FiscalYear[]> {
    const years = await this.prisma.fiscalYear.findMany({
      where: { organizationId },
      orderBy: { startDate: "desc" },
    });
    return years.map(toFiscalYear);
  }

  async findById(id: string, organizationId: string): Promise<FiscalYear | null> {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId },
    });
    return fy ? toFiscalYear(fy) : null;
  }

  async findPreviousByDate(organizationId: string, beforeDate: Date): Promise<FiscalYear | null> {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: {
        organizationId,
        endDate: { lt: beforeDate },
      },
      orderBy: { endDate: "desc" },
    });
    return fy ? toFiscalYear(fy) : null;
  }

  async create(input: CreateFiscalYearInput): Promise<Result<FiscalYear, FiscalYearError>> {
    // Validate date range
    if (input.endDate <= input.startDate) {
      return err({
        code: "INVALID_DATE_RANGE",
        message: "Slutdatum måste vara efter startdatum",
      });
    }

    // Validate fiscal year length (BFL 3:1 – max 18 months)
    const startDate = new Date(input.startDate);
    const endDate = new Date(input.endDate);
    const months =
      (endDate.getFullYear() - startDate.getFullYear()) * 12 +
      (endDate.getMonth() - startDate.getMonth()) +
      (endDate.getDate() >= startDate.getDate() ? 0 : -1) +
      1; // +1 because both start and end months count
    if (months > 18) {
      return err({
        code: "INVALID_LENGTH",
        message: "Räkenskapsåret får vara högst 18 månader (BFL 3:1)",
      });
    }

    // Check for overlapping fiscal years
    const existing = await this.prisma.fiscalYear.findMany({
      where: { organizationId: input.organizationId },
    });

    const overlaps = existing.some((fy) => {
      const existingStart = fy.startDate.getTime();
      const existingEnd = fy.endDate.getTime();
      const newStart = input.startDate.getTime();
      const newEnd = input.endDate.getTime();
      return newStart <= existingEnd && newEnd >= existingStart;
    });

    if (overlaps) {
      return err({
        code: "OVERLAPPING_YEAR",
        message: "Räkenskapsåret överlappar med ett befintligt",
      });
    }

    const fy = await this.prisma.fiscalYear.create({
      data: {
        organizationId: input.organizationId,
        startDate: input.startDate,
        endDate: input.endDate,
      },
    });

    return ok(toFiscalYear(fy));
  }

  /**
   * Close a fiscal year.
   * Creates a closing voucher (bokslutsverifikat) that zeros out all
   * P&L accounts (3xxx-8xxx) against 2099 (Årets resultat), then marks
   * the year as closed.
   */
  async close(id: string, organizationId: string): Promise<Result<FiscalYear, FiscalYearError>> {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId },
    });

    if (!fy) {
      return err({
        code: "NOT_FOUND",
        message: "Räkenskapsåret hittades inte",
      });
    }

    if (fy.isClosed) {
      return err({
        code: "YEAR_CLOSED",
        message: "Räkenskapsåret är redan stängt",
      });
    }

    // Get all vouchers for this fiscal year to calculate P&L balances
    const vouchers = await this.prisma.voucher.findMany({
      where: { fiscalYearId: id, organizationId },
      include: { lines: true },
    });

    // Aggregate net balances per P&L account (3xxx-8xxx)
    const plBalances = new Map<string, number>(); // accountNumber → credit - debit
    for (const v of vouchers) {
      for (const line of v.lines) {
        const num = parseInt(line.accountNumber, 10);
        if (num >= 3000 && num <= 8999) {
          const existing = plBalances.get(line.accountNumber) ?? 0;
          plBalances.set(line.accountNumber, existing + line.credit - line.debit);
        }
      }
    }

    // Only create closing voucher if there are P&L balances
    const nonZeroEntries = [...plBalances.entries()].filter(([, bal]) => bal !== 0);

    if (nonZeroEntries.length > 0) {
      // Find account IDs for P&L accounts + 2099
      const accountNumbers = [...nonZeroEntries.map(([num]) => num), "2099"];
      const accounts = await this.prisma.account.findMany({
        where: { organizationId, number: { in: accountNumbers } },
      });
      const accountIdMap = new Map(accounts.map((a) => [a.number, a.id]));

      // Ensure 2099 exists
      let resultAccountId = accountIdMap.get("2099");
      if (!resultAccountId) {
        const created = await this.prisma.account.create({
          data: {
            organizationId,
            number: "2099",
            name: "Årets resultat",
            type: "EQUITY",
          },
        });
        resultAccountId = created.id;
      }

      // Get next voucher number
      const lastVoucher = await this.prisma.voucher.findFirst({
        where: { fiscalYearId: id },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      const nextNumber = (lastVoucher?.number ?? 0) + 1;

      // Build closing voucher lines:
      // For each P&L account, reverse its balance (debit what was credited, credit what was debited)
      // Then book the net result to 2099
      const closingLines: Array<{
        accountId: string;
        accountNumber: string;
        debit: number;
        credit: number;
      }> = [];

      let totalResult = 0; // Net year result (positive = profit)

      for (const [accountNumber, balance] of nonZeroEntries) {
        const accId = accountIdMap.get(accountNumber);
        if (!accId) continue;

        // Reverse the balance: if credit > debit (positive balance), we debit; if debit > credit, we credit
        if (balance > 0) {
          closingLines.push({ accountId: accId, accountNumber, debit: balance, credit: 0 });
        } else {
          closingLines.push({ accountId: accId, accountNumber, debit: 0, credit: -balance });
        }
        totalResult += balance;
      }

      // Book net result to 2099 (Årets resultat)
      if (totalResult > 0) {
        // Profit: credit 2099
        closingLines.push({
          accountId: resultAccountId,
          accountNumber: "2099",
          debit: 0,
          credit: totalResult,
        });
      } else if (totalResult < 0) {
        // Loss: debit 2099
        closingLines.push({
          accountId: resultAccountId,
          accountNumber: "2099",
          debit: -totalResult,
          credit: 0,
        });
      }

      // Create the closing voucher
      await this.prisma.voucher.create({
        data: {
          organizationId,
          fiscalYearId: id,
          number: nextNumber,
          date: fy.endDate,
          description: "Bokslutsverifikat",
          lines: {
            create: closingLines,
          },
        },
      });
    }

    const updated = await this.prisma.fiscalYear.update({
      where: { id },
      data: { isClosed: true },
    });

    return ok(toFiscalYear(updated));
  }

  /**
   * Create opening balances for a new fiscal year by carrying forward
   * all balance sheet account balances (1xxx-2xxx) from the previous
   * fiscal year.
   */
  async createOpeningBalances(
    fiscalYearId: string,
    previousFiscalYearId: string,
    organizationId: string,
  ): Promise<Result<Voucher, FiscalYearError>> {
    // Verify both fiscal years exist
    const [fy, prevFy] = await Promise.all([
      this.prisma.fiscalYear.findFirst({ where: { id: fiscalYearId, organizationId } }),
      this.prisma.fiscalYear.findFirst({ where: { id: previousFiscalYearId, organizationId } }),
    ]);

    if (!fy || !prevFy) {
      return err({ code: "NOT_FOUND", message: "Räkenskapsåret hittades inte" });
    }

    if (!prevFy.isClosed) {
      return err({ code: "YEAR_CLOSED", message: "Föregående räkenskapsår måste vara stängt" });
    }

    // Get all vouchers from previous year
    const vouchers = await this.prisma.voucher.findMany({
      where: { fiscalYearId: previousFiscalYearId, organizationId },
      include: { lines: true },
    });

    // Aggregate balance sheet accounts (1xxx-2xxx)
    const balances = new Map<string, number>(); // accountNumber → debit - credit
    for (const v of vouchers) {
      for (const line of v.lines) {
        const num = parseInt(line.accountNumber, 10);
        if (num >= 1000 && num <= 2999) {
          const existing = balances.get(line.accountNumber) ?? 0;
          balances.set(line.accountNumber, existing + line.debit - line.credit);
        }
      }
    }

    const nonZeroEntries = [...balances.entries()].filter(([, bal]) => bal !== 0);
    if (nonZeroEntries.length === 0) {
      return err({ code: "INVALID_DATE_RANGE", message: "Inga saldon att föra framåt" });
    }

    // Get account IDs
    const accountNumbers = nonZeroEntries.map(([num]) => num);
    const accounts = await this.prisma.account.findMany({
      where: { organizationId, number: { in: accountNumbers } },
    });
    const accountIdMap = new Map(accounts.map((a) => [a.number, a.id]));

    // Get next voucher number for new year
    const lastVoucher = await this.prisma.voucher.findFirst({
      where: { fiscalYearId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (lastVoucher?.number ?? 0) + 1;

    // Build IB lines
    const ibLines: Array<{
      accountId: string;
      accountNumber: string;
      debit: number;
      credit: number;
    }> = [];

    for (const [accountNumber, balance] of nonZeroEntries) {
      const accId = accountIdMap.get(accountNumber);
      if (!accId) continue;

      if (balance > 0) {
        ibLines.push({ accountId: accId, accountNumber, debit: balance, credit: 0 });
      } else {
        ibLines.push({ accountId: accId, accountNumber, debit: 0, credit: -balance });
      }
    }

    const voucher = await this.prisma.voucher.create({
      data: {
        organizationId,
        fiscalYearId,
        number: nextNumber,
        date: fy.startDate,
        description: "Ingående balanser",
        lines: {
          create: ibLines,
        },
      },
      include: voucherInclude,
    });

    return ok(toVoucher(voucher));
  }

  /**
   * Execute result disposition: transfer the year's result from
   * 2099 (Årets resultat) to 2091 (Balanserat resultat).
   *
   * Creates a voucher in the target fiscal year.
   */
  async executeResultDisposition(
    input: ExecuteResultDispositionInput,
  ): Promise<Result<Voucher, ResultDispositionError>> {
    const { closedFiscalYearId, targetFiscalYearId, organizationId } = input;

    // Verify closed fiscal year
    const closedFy = await this.prisma.fiscalYear.findFirst({
      where: { id: closedFiscalYearId, organizationId },
    });
    if (!closedFy) {
      return err({ code: "NOT_FOUND", message: "Stängt räkenskapsår hittades inte" });
    }
    if (!closedFy.isClosed) {
      return err({ code: "YEAR_NOT_CLOSED", message: "Räkenskapsåret måste vara stängt" });
    }

    // Verify target fiscal year
    const targetFy = await this.prisma.fiscalYear.findFirst({
      where: { id: targetFiscalYearId, organizationId },
    });
    if (!targetFy) {
      return err({ code: "TARGET_YEAR_REQUIRED", message: "Målräkenskapsår hittades inte" });
    }
    if (targetFy.isClosed) {
      return err({ code: "TARGET_YEAR_CLOSED", message: "Målräkenskapsåret får inte vara stängt" });
    }

    // Calculate 2099 balance from closed year (credit - debit)
    const closedVouchers = await this.prisma.voucher.findMany({
      where: { fiscalYearId: closedFiscalYearId, organizationId },
      include: { lines: true },
    });

    let account2099Balance = 0;
    for (const v of closedVouchers) {
      for (const line of v.lines) {
        if (line.accountNumber === ACCOUNT_YEAR_RESULT) {
          account2099Balance += line.credit - line.debit;
        }
      }
    }

    if (account2099Balance === 0) {
      return err({
        code: "ALREADY_DISPOSED",
        message: "Resultatet har redan disponerats eller är noll",
      });
    }

    // Ensure accounts 2099 and 2091 exist
    const accountNumbers = [ACCOUNT_YEAR_RESULT, ACCOUNT_RETAINED_EARNINGS];
    const existingAccounts = await this.prisma.account.findMany({
      where: { organizationId, number: { in: accountNumbers } },
    });
    const accountIdMap = new Map(existingAccounts.map((a) => [a.number, a.id]));

    // Create 2091 if it doesn't exist
    if (!accountIdMap.has(ACCOUNT_RETAINED_EARNINGS)) {
      const created = await this.prisma.account.create({
        data: {
          organizationId,
          number: ACCOUNT_RETAINED_EARNINGS,
          name: "Balanserat resultat",
          type: "EQUITY",
        },
      });
      accountIdMap.set(ACCOUNT_RETAINED_EARNINGS, created.id);
    }

    // Create 2099 if it doesn't exist (should always exist after closing)
    if (!accountIdMap.has(ACCOUNT_YEAR_RESULT)) {
      const created = await this.prisma.account.create({
        data: {
          organizationId,
          number: ACCOUNT_YEAR_RESULT,
          name: "Årets resultat",
          type: "EQUITY",
        },
      });
      accountIdMap.set(ACCOUNT_YEAR_RESULT, created.id);
    }

    const account2099Id = accountIdMap.get(ACCOUNT_YEAR_RESULT);
    const account2091Id = accountIdMap.get(ACCOUNT_RETAINED_EARNINGS);

    if (!account2099Id || !account2091Id) {
      return err({ code: "NOT_FOUND", message: "Konton 2099/2091 kunde inte skapas" });
    }

    // Build disposition lines
    const dispositionLines: Array<{
      accountId: string;
      accountNumber: string;
      debit: number;
      credit: number;
    }> = [];

    if (account2099Balance > 0) {
      // Profit: debit 2099, credit 2091
      dispositionLines.push({
        accountId: account2099Id,
        accountNumber: ACCOUNT_YEAR_RESULT,
        debit: account2099Balance,
        credit: 0,
      });
      dispositionLines.push({
        accountId: account2091Id,
        accountNumber: ACCOUNT_RETAINED_EARNINGS,
        debit: 0,
        credit: account2099Balance,
      });
    } else {
      // Loss: credit 2099, debit 2091
      const absBalance = -account2099Balance;
      dispositionLines.push({
        accountId: account2099Id,
        accountNumber: ACCOUNT_YEAR_RESULT,
        debit: 0,
        credit: absBalance,
      });
      dispositionLines.push({
        accountId: account2091Id,
        accountNumber: ACCOUNT_RETAINED_EARNINGS,
        debit: absBalance,
        credit: 0,
      });
    }

    // Get next voucher number in target year
    const lastVoucher = await this.prisma.voucher.findFirst({
      where: { fiscalYearId: targetFiscalYearId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const nextNumber = (lastVoucher?.number ?? 0) + 1;

    // Create disposition voucher in target year
    const voucher = await this.prisma.voucher.create({
      data: {
        organizationId,
        fiscalYearId: targetFiscalYearId,
        number: nextNumber,
        date: targetFy.startDate,
        description: "Resultatdisposition",
        lines: {
          create: dispositionLines,
        },
      },
      include: voucherInclude,
    });

    return ok(toVoucher(voucher));
  }
}
