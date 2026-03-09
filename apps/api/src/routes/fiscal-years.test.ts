import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import { ok, err } from "@muninsbok/core/types";

describe("Fiscal year routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";
  const baseFy = {
    id: "fy-1",
    organizationId: orgId,
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe("GET /:orgId/fiscal-years", () => {
    it("returns fiscal years for organization", async () => {
      repos.fiscalYears.findByOrganization.mockResolvedValue([baseFy]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(repos.fiscalYears.findByOrganization).toHaveBeenCalledWith(orgId);
    });

    it("returns empty array when no fiscal years", async () => {
      repos.fiscalYears.findByOrganization.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toEqual([]);
    });
  });

  describe("GET /:orgId/fiscal-years/:fyId", () => {
    it("returns single fiscal year", async () => {
      repos.fiscalYears.findById.mockResolvedValue(baseFy);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years/fy-1`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.id).toBe("fy-1");
    });

    it("returns 404 when not found", async () => {
      repos.fiscalYears.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years/unknown`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("POST /:orgId/fiscal-years", () => {
    it("creates fiscal year successfully", async () => {
      repos.fiscalYears.create.mockResolvedValue(ok(baseFy));

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/fiscal-years`,
        payload: { startDate: "2024-01-01", endDate: "2024-12-31" },
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.id).toBe("fy-1");
      expect(repos.fiscalYears.create).toHaveBeenCalledWith({
        organizationId: orgId,
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it("returns 400 when dates overlap", async () => {
      repos.fiscalYears.create.mockResolvedValue(
        err({ code: "OVERLAPPING_DATES" as const, message: "Overlapping fiscal year" }),
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/fiscal-years`,
        payload: { startDate: "2024-01-01", endDate: "2024-12-31" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 with invalid body", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/fiscal-years`,
        payload: { startDate: "" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /:orgId/fiscal-years/:fyId/close", () => {
    it("closes fiscal year successfully", async () => {
      repos.fiscalYears.close.mockResolvedValue(ok({ ...baseFy, isClosed: true }));

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/fiscal-years/fy-1/close`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.isClosed).toBe(true);
    });

    it("returns 404 when fiscal year not found", async () => {
      repos.fiscalYears.close.mockResolvedValue(
        err({ code: "NOT_FOUND" as const, message: "Not found" }),
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/fiscal-years/unknown/close`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when already closed", async () => {
      repos.fiscalYears.close.mockResolvedValue(
        err({ code: "ALREADY_CLOSED" as const, message: "Already closed" }),
      );

      const res = await app.inject({
        method: "PATCH",
        url: `/api/organizations/${orgId}/fiscal-years/fy-1/close`,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /:orgId/fiscal-years/:fyId/close-preview", () => {
    const baseUrl = `/api/organizations/${orgId}/fiscal-years/fy-1/close-preview`;

    it("returns closing preview with converted kronor amounts", async () => {
      repos.fiscalYears.findById.mockResolvedValue(baseFy);
      repos.vouchers.findByFiscalYear.mockResolvedValue([
        {
          id: "v1",
          organizationId: orgId,
          fiscalYearId: "fy-1",
          number: 1,
          date: new Date("2024-03-01"),
          description: "Försäljning",
          lines: [
            { id: "l1", voucherId: "v1", accountNumber: "1930", debit: 100000, credit: 0 },
            { id: "l2", voucherId: "v1", accountNumber: "3000", debit: 0, credit: 100000 },
          ],
          documentIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "v2",
          organizationId: orgId,
          fiscalYearId: "fy-1",
          number: 2,
          date: new Date("2024-04-01"),
          description: "Kostnad",
          lines: [
            { id: "l3", voucherId: "v2", accountNumber: "5010", debit: 30000, credit: 0 },
            { id: "l4", voucherId: "v2", accountNumber: "1930", debit: 0, credit: 30000 },
          ],
          documentIds: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      repos.accounts.findByOrganization.mockResolvedValue([
        { number: "1930", name: "Bank", type: "ASSET", isVatAccount: false, isActive: true },
        {
          number: "3000",
          name: "Försäljning",
          type: "REVENUE",
          isVatAccount: false,
          isActive: true,
        },
        {
          number: "5010",
          name: "Lokalkostnad",
          type: "EXPENSE",
          isVatAccount: false,
          isActive: true,
        },
      ]);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.totalRevenues).toBe(1000); // 100000 öre → 1000 kr
      expect(body.data.totalExpenses).toBe(300); // 30000 öre → 300 kr
      expect(body.data.netResult).toBe(700); // (100000 - 30000) / 100
      expect(body.data.isBalanced).toBe(true);
      expect(body.data.hasEntries).toBe(true);
      expect(body.data.accountCount).toBe(2); // 3000, 5010
      expect(body.data.resultEntry.accountNumber).toBe("2099");
      expect(body.data.resultEntry.credit).toBe(700); // Profit → credit
      expect(body.data.revenues.lines).toHaveLength(1);
      expect(body.data.expenses.lines).toHaveLength(1);
    });

    it("returns 404 when fiscal year not found", async () => {
      repos.fiscalYears.findById.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when fiscal year is already closed", async () => {
      repos.fiscalYears.findById.mockResolvedValue({ ...baseFy, isClosed: true });

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(400);
    });

    it("returns empty preview when no vouchers", async () => {
      repos.fiscalYears.findById.mockResolvedValue(baseFy);
      repos.vouchers.findByFiscalYear.mockResolvedValue([]);
      repos.accounts.findByOrganization.mockResolvedValue([]);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.hasEntries).toBe(false);
      expect(body.data.accountCount).toBe(0);
      expect(body.data.netResult).toBe(0);
    });
  });

  // ── Result Disposition ──────────────────────────────────

  const closedFy = { ...baseFy, id: "fy-closed", isClosed: true };
  const targetFyId = "fy-target";

  // Vouchers simulating a closed year with 2099 balance (profit of 120000 öre = 1200 kr)
  const closedYearVouchers = [
    {
      id: "v1",
      organizationId: orgId,
      fiscalYearId: "fy-closed",
      number: 1,
      date: new Date("2024-03-01"),
      description: "Försäljning",
      lines: [
        { id: "l1", voucherId: "v1", accountNumber: "1930", debit: 200_000, credit: 0 },
        { id: "l2", voucherId: "v1", accountNumber: "3000", debit: 0, credit: 200_000 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "v2",
      organizationId: orgId,
      fiscalYearId: "fy-closed",
      number: 2,
      date: new Date("2024-06-01"),
      description: "Kostnad",
      lines: [
        { id: "l3", voucherId: "v2", accountNumber: "5010", debit: 80_000, credit: 0 },
        { id: "l4", voucherId: "v2", accountNumber: "1930", debit: 0, credit: 80_000 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      // Closing voucher
      id: "v3",
      organizationId: orgId,
      fiscalYearId: "fy-closed",
      number: 3,
      date: new Date("2024-12-31"),
      description: "Bokslutsverifikat",
      lines: [
        { id: "l5", voucherId: "v3", accountNumber: "3000", debit: 200_000, credit: 0 },
        { id: "l6", voucherId: "v3", accountNumber: "5010", debit: 0, credit: 80_000 },
        { id: "l7", voucherId: "v3", accountNumber: "2099", debit: 0, credit: 120_000 },
      ],
      documentIds: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const accounts = [
    { number: "1930", name: "Bank", type: "ASSET" as const, isVatAccount: false, isActive: true },
    {
      number: "2091",
      name: "Balanserat resultat",
      type: "EQUITY" as const,
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "2099",
      name: "Årets resultat",
      type: "EQUITY" as const,
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "3000",
      name: "Försäljning",
      type: "REVENUE" as const,
      isVatAccount: false,
      isActive: true,
    },
    {
      number: "5010",
      name: "Lokalkostnad",
      type: "EXPENSE" as const,
      isVatAccount: false,
      isActive: true,
    },
  ];

  describe("GET /:orgId/fiscal-years/:fyId/disposition-preview", () => {
    const baseUrl = `/api/organizations/${orgId}/fiscal-years/fy-closed/disposition-preview?targetFyId=${targetFyId}`;

    it("returns disposition preview with correct amounts", async () => {
      repos.fiscalYears.findById.mockResolvedValue(closedFy);
      repos.vouchers.findByFiscalYear.mockResolvedValue(closedYearVouchers);
      repos.accounts.findByOrganization.mockResolvedValue(accounts);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.netResult).toBe(1200); // 120000 öre → 1200 kr
      expect(body.data.lines).toHaveLength(2);
      expect(body.data.isBalanced).toBe(true);
      expect(body.data.closedFiscalYearId).toBe("fy-closed");
      expect(body.data.targetFiscalYearId).toBe(targetFyId);
    });

    it("returns 404 when fiscal year not found", async () => {
      repos.fiscalYears.findById.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: baseUrl });
      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when fiscal year is not closed", async () => {
      repos.fiscalYears.findById.mockResolvedValue(baseFy); // isClosed: false

      const res = await app.inject({ method: "GET", url: baseUrl });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /:orgId/fiscal-years/:fyId/disposition", () => {
    const url = `/api/organizations/${orgId}/fiscal-years/${targetFyId}/disposition`;

    it("executes disposition successfully", async () => {
      const dispositionVoucher = {
        id: "v-disp",
        fiscalYearId: targetFyId,
        organizationId: orgId,
        number: 1,
        date: new Date("2025-01-01"),
        description: "Resultatdisposition",
        lines: [],
        documentIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      repos.fiscalYears.executeResultDisposition.mockResolvedValue(ok(dispositionVoucher));

      const res = await app.inject({
        method: "POST",
        url,
        payload: { closedFiscalYearId: "fy-closed" },
      });

      expect(res.statusCode).toBe(201);
      expect(repos.fiscalYears.executeResultDisposition).toHaveBeenCalledWith({
        closedFiscalYearId: "fy-closed",
        targetFiscalYearId: targetFyId,
        organizationId: orgId,
      });
    });

    it("returns 404 when closed fiscal year not found", async () => {
      repos.fiscalYears.executeResultDisposition.mockResolvedValue(
        err({ code: "NOT_FOUND" as const, message: "Not found" }),
      );

      const res = await app.inject({
        method: "POST",
        url,
        payload: { closedFiscalYearId: "fy-unknown" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when year not closed", async () => {
      repos.fiscalYears.executeResultDisposition.mockResolvedValue(
        err({ code: "YEAR_NOT_CLOSED" as const, message: "Not closed" }),
      );

      const res = await app.inject({
        method: "POST",
        url,
        payload: { closedFiscalYearId: "fy-open" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when already disposed", async () => {
      repos.fiscalYears.executeResultDisposition.mockResolvedValue(
        err({ code: "ALREADY_DISPOSED" as const, message: "Already disposed" }),
      );

      const res = await app.inject({
        method: "POST",
        url,
        payload: { closedFiscalYearId: "fy-closed" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /:orgId/fiscal-years/:fyId/year-end-summary", () => {
    const baseUrl = `/api/organizations/${orgId}/fiscal-years/fy-closed/year-end-summary?targetFyId=${targetFyId}`;

    it("returns year-end summary with all sections", async () => {
      repos.fiscalYears.findById.mockResolvedValue(closedFy);
      repos.vouchers.findByFiscalYear.mockResolvedValue(closedYearVouchers);
      repos.accounts.findByOrganization.mockResolvedValue(accounts);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.fiscalYear.id).toBe("fy-closed");
      expect(body.data.fiscalYear.isClosed).toBe(true);
      expect(body.data.incomeStatement).toBeDefined();
      expect(body.data.balanceSheet).toBeDefined();
      expect(body.data.disposition).not.toBeNull();
      expect(body.data.disposition.netResult).toBe(1200);
      expect(body.data.isDisposed).toBe(false);
    });

    it("returns 404 when fiscal year not found", async () => {
      repos.fiscalYears.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years/unknown/year-end-summary`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns summary without disposition for open year", async () => {
      repos.fiscalYears.findById.mockResolvedValue(baseFy);
      repos.vouchers.findByFiscalYear.mockResolvedValue([]);
      repos.accounts.findByOrganization.mockResolvedValue(accounts);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/fiscal-years/fy-1/year-end-summary`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.disposition).toBeNull();
      expect(body.data.isDisposed).toBe(false);
    });
  });
});
