import type { FastifyInstance } from "fastify";
import { parseCsv, mapCsvToTransactions, type CsvColumnMapping } from "@muninsbok/core/csv-import";

export async function csvImportRoutes(fastify: FastifyInstance) {
  const voucherRepo = fastify.repos.vouchers;
  const accountRepo = fastify.repos.accounts;
  const fyRepo = fastify.repos.fiscalYears;

  /**
   * POST /:orgId/import/csv/preview
   * Parse CSV text and return a preview of the transactions.
   * Body: { csv: string, mapping: { dateColumn, descriptionColumn, amountColumn } }
   */
  fastify.post<{
    Params: { orgId: string };
    Body: {
      csv: string;
      mapping: CsvColumnMapping;
    };
  }>("/:orgId/import/csv/preview", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "Request body krävs" });
    }

    const csv = body["csv"];
    if (typeof csv !== "string" || csv.trim().length === 0) {
      return reply.status(400).send({ error: "CSV-data krävs" });
    }

    const mapping = body["mapping"] as CsvColumnMapping | undefined;
    if (
      !mapping ||
      typeof mapping.dateColumn !== "number" ||
      typeof mapping.descriptionColumn !== "number" ||
      typeof mapping.amountColumn !== "number"
    ) {
      return reply
        .status(400)
        .send({ error: "Kolumnmappning krävs (dateColumn, descriptionColumn, amountColumn)" });
    }

    const parsed = parseCsv(csv);
    if (parsed.headers.length === 0) {
      return reply.status(400).send({ error: "Ingen CSV-data hittades" });
    }

    const maxCol = Math.max(mapping.dateColumn, mapping.descriptionColumn, mapping.amountColumn);
    if (maxCol >= parsed.headers.length) {
      return reply.status(400).send({
        error: `Kolumnindex ${maxCol} är utanför intervallet (0–${parsed.headers.length - 1})`,
      });
    }

    const result = mapCsvToTransactions(parsed, mapping);

    return {
      data: {
        headers: parsed.headers,
        rows: result.transactions.map((t) => ({
          date: t.date,
          description: t.description,
          amount: t.amount / 100, // öre → kronor for display
        })),
        errors: result.errors,
        totalRows: result.totalRows,
      },
    };
  });

  /**
   * POST /:orgId/import/csv/execute
   * Create vouchers from imported bank transactions.
   * Body: {
   *   fiscalYearId: string,
   *   bankAccountNumber: string,     // e.g. "1930"
   *   defaultAccountNumber: string,  // e.g. "3000" for income, "5010" for expense
   *   transactions: Array<{ date, description, amount, accountNumber? }>
   * }
   */
  fastify.post<{
    Params: { orgId: string };
    Body: {
      fiscalYearId: string;
      bankAccountNumber: string;
      defaultAccountNumber: string;
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        accountNumber?: string;
      }>;
    };
  }>("/:orgId/import/csv/execute", async (request, reply) => {
    const { orgId } = request.params;
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "Request body krävs" });
    }

    const fiscalYearId = body["fiscalYearId"];
    const bankAccountNumber = body["bankAccountNumber"];
    const defaultAccountNumber = body["defaultAccountNumber"];
    const transactions = body["transactions"];

    if (typeof fiscalYearId !== "string" || !fiscalYearId) {
      return reply.status(400).send({ error: "fiscalYearId krävs" });
    }

    if (typeof bankAccountNumber !== "string" || !bankAccountNumber) {
      return reply.status(400).send({ error: "bankAccountNumber krävs (t.ex. 1930)" });
    }

    if (typeof defaultAccountNumber !== "string" || !defaultAccountNumber) {
      return reply.status(400).send({ error: "defaultAccountNumber krävs" });
    }

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return reply.status(400).send({ error: "Minst en transaktion krävs" });
    }

    // Verify fiscal year exists
    const fy = await fyRepo.findById(fiscalYearId, orgId);
    if (!fy) {
      return reply.status(404).send({ error: "Räkenskapsåret hittades inte" });
    }

    if (fy.isClosed) {
      return reply.status(400).send({ error: "Räkenskapsåret är stängt" });
    }

    // Verify accounts exist
    const accounts = await accountRepo.findByOrganization(orgId);
    const accountMap = new Map(accounts.map((a) => [a.number, a]));

    if (!accountMap.has(bankAccountNumber)) {
      return reply
        .status(400)
        .send({ error: `Bankkonto ${bankAccountNumber} finns inte i kontoplanen` });
    }

    if (!accountMap.has(defaultAccountNumber)) {
      return reply
        .status(400)
        .send({ error: `Motkonto ${defaultAccountNumber} finns inte i kontoplanen` });
    }

    let vouchersCreated = 0;
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i] as Record<string, unknown>;
      const date = tx["date"] as string;
      const description = tx["description"] as string;
      const amount = tx["amount"] as number;
      const contraAccount: string = (tx["accountNumber"] as string) || defaultAccountNumber;

      if (!date || !description || typeof amount !== "number" || amount === 0) {
        errors.push(`Rad ${i + 1}: Ogiltig transaktion`);
        continue;
      }

      if (contraAccount !== defaultAccountNumber && !accountMap.has(contraAccount)) {
        errors.push(`Rad ${i + 1}: Konto ${contraAccount} finns inte`);
        continue;
      }

      // Amount is in öre. Positive = income (debit bank, credit contra).
      // Negative = expense (credit bank, debit contra).
      const absAmount = Math.abs(amount);
      const lines =
        amount > 0
          ? [
              { accountNumber: bankAccountNumber, debit: absAmount, credit: 0 },
              { accountNumber: contraAccount, debit: 0, credit: absAmount },
            ]
          : [
              { accountNumber: contraAccount, debit: absAmount, credit: 0 },
              { accountNumber: bankAccountNumber, debit: 0, credit: absAmount },
            ];

      const result = await voucherRepo.create({
        organizationId: orgId,
        fiscalYearId,
        date: new Date(date),
        description,
        lines,
      });

      if (result.ok) {
        vouchersCreated++;
      } else {
        const errMsg =
          typeof result.error === "object" && result.error && "message" in result.error
            ? (result.error as { message: string }).message
            : String(result.error);
        errors.push(`Rad ${i + 1}: ${errMsg}`);
      }
    }

    return { data: { vouchersCreated, errors } };
  });

  /**
   * POST /:orgId/import/csv/parse
   * Just parse CSV and return headers — for column mapping UI.
   */
  fastify.post<{
    Params: { orgId: string };
  }>("/:orgId/import/csv/parse", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return reply.status(400).send({ error: "Request body krävs" });
    }

    const csv = body["csv"];
    if (typeof csv !== "string" || csv.trim().length === 0) {
      return reply.status(400).send({ error: "CSV-data krävs" });
    }

    const parsed = parseCsv(csv);
    if (parsed.headers.length === 0) {
      return reply.status(400).send({ error: "Ingen CSV-data hittades" });
    }

    // Return headers + first 5 sample rows for mapping UI
    const sampleRows = parsed.rows.slice(0, 5).map((r) => r.values);

    return {
      data: {
        headers: parsed.headers,
        sampleRows,
        totalRows: parsed.rows.length,
      },
    };
  });
}
