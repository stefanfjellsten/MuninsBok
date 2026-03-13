import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { ok, err } from "@muninsbok/core/types";
import { buildTestApp, type MockRepos } from "../test/helpers.js";

describe("Voucher template routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
  });

  const orgId = "org-1";
  const baseUrl = `/api/organizations/${orgId}/templates`;

  const sampleTemplate = {
    id: "tpl-1",
    organizationId: orgId,
    name: "Månadshyra",
    description: "Hyra kontor",
    lines: [
      { id: "tl-1", templateId: "tpl-1", accountNumber: "5010", debit: 500000, credit: 0 },
      {
        id: "tl-2",
        templateId: "tpl-1",
        accountNumber: "1930",
        debit: 0,
        credit: 500000,
        description: "PG",
      },
    ],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  // ── GET /:orgId/templates ─────────────────────────────────

  describe("GET /:orgId/templates", () => {
    it("returns all templates for the organization", async () => {
      repos.voucherTemplates.findByOrganization.mockResolvedValue([sampleTemplate]);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe("Månadshyra");
    });

    it("returns empty list when no templates exist", async () => {
      repos.voucherTemplates.findByOrganization.mockResolvedValue([]);

      const res = await app.inject({ method: "GET", url: baseUrl });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(0);
    });
  });

  // ── GET /:orgId/templates/:templateId ─────────────────────

  describe("GET /:orgId/templates/:templateId", () => {
    it("returns template by id", async () => {
      repos.voucherTemplates.findById.mockResolvedValue(sampleTemplate);

      const res = await app.inject({ method: "GET", url: `${baseUrl}/tpl-1` });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Månadshyra");
    });

    it("returns 404 for non-existent template", async () => {
      repos.voucherTemplates.findById.mockResolvedValue(null);

      const res = await app.inject({ method: "GET", url: `${baseUrl}/missing` });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /:orgId/templates ────────────────────────────────

  describe("POST /:orgId/templates", () => {
    const validPayload = {
      name: "Ny mall",
      description: "Test",
      lines: [
        { accountNumber: "5010", debit: 100000, credit: 0 },
        { accountNumber: "1930", debit: 0, credit: 100000 },
      ],
    };

    it("creates a template and returns 201", async () => {
      repos.voucherTemplates.create.mockResolvedValue(ok(sampleTemplate));

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      expect(JSON.parse(res.body).data.name).toBe("Månadshyra");
      expect(repos.voucherTemplates.create).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({ name: "Ny mall" }),
      );
    });

    it("returns 400 on duplicate name", async () => {
      repos.voucherTemplates.create.mockResolvedValue(
        err({ code: "DUPLICATE_NAME", message: "Finns redan" }),
      );

      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: validPayload,
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on missing name", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: { lines: [{ accountNumber: "1910", debit: 100, credit: 0 }] },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on empty lines", async () => {
      const res = await app.inject({
        method: "POST",
        url: baseUrl,
        payload: { name: "Tom", lines: [] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── PUT /:orgId/templates/:templateId ─────────────────────

  describe("PUT /:orgId/templates/:templateId", () => {
    it("updates template name", async () => {
      repos.voucherTemplates.update.mockResolvedValue(
        ok({ ...sampleTemplate, name: "Uppdaterad" }),
      );

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/tpl-1`,
        payload: { name: "Uppdaterad" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.name).toBe("Uppdaterad");
    });

    it("updates template lines", async () => {
      repos.voucherTemplates.update.mockResolvedValue(ok(sampleTemplate));

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/tpl-1`,
        payload: {
          lines: [
            { accountNumber: "6000", debit: 200000, credit: 0 },
            { accountNumber: "1930", debit: 0, credit: 200000 },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it("returns 404 when template not found", async () => {
      repos.voucherTemplates.update.mockResolvedValue(
        err({ code: "NOT_FOUND", message: "Hittades inte" }),
      );

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/missing`,
        payload: { name: "Ny" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 on duplicate name", async () => {
      repos.voucherTemplates.update.mockResolvedValue(
        err({ code: "DUPLICATE_NAME", message: "Finns redan" }),
      );

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/tpl-1`,
        payload: { name: "Dublett" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── DELETE /:orgId/templates/:templateId ──────────────────

  describe("DELETE /:orgId/templates/:templateId", () => {
    it("deletes a template and returns 204", async () => {
      repos.voucherTemplates.delete.mockResolvedValue(true);

      const res = await app.inject({
        method: "DELETE",
        url: `${baseUrl}/tpl-1`,
      });

      expect(res.statusCode).toBe(204);
    });

    it("returns 404 when template not found", async () => {
      repos.voucherTemplates.delete.mockResolvedValue(false);

      const res = await app.inject({
        method: "DELETE",
        url: `${baseUrl}/missing`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── PUT /:orgId/templates/:templateId/recurring ───────────

  describe("PUT /:orgId/templates/:templateId/recurring", () => {
    it("enables recurring schedule on a template", async () => {
      const scheduledTemplate = {
        ...sampleTemplate,
        isRecurring: true,
        frequency: "MONTHLY" as const,
        dayOfMonth: 25,
        nextRunDate: new Date("2025-02-25"),
      };
      repos.voucherTemplates.updateRecurringSchedule.mockResolvedValue(scheduledTemplate);

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/tpl-1/recurring`,
        payload: {
          isRecurring: true,
          frequency: "MONTHLY",
          dayOfMonth: 25,
          nextRunDate: "2025-02-25T00:00:00.000Z",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.isRecurring).toBe(true);
      expect(body.data.frequency).toBe("MONTHLY");
    });

    it("disables recurring schedule", async () => {
      const disabledTemplate = { ...sampleTemplate, isRecurring: false };
      repos.voucherTemplates.updateRecurringSchedule.mockResolvedValue(disabledTemplate);

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/tpl-1/recurring`,
        payload: { isRecurring: false },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data.isRecurring).toBe(false);
    });

    it("returns 400 when recurring without frequency", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/tpl-1/recurring`,
        payload: { isRecurring: true, dayOfMonth: 15 },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 when recurring without dayOfMonth", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/tpl-1/recurring`,
        payload: { isRecurring: true, frequency: "MONTHLY" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 when template not found", async () => {
      repos.voucherTemplates.updateRecurringSchedule.mockResolvedValue(null);

      const res = await app.inject({
        method: "PUT",
        url: `${baseUrl}/missing/recurring`,
        payload: { isRecurring: true, frequency: "QUARTERLY", dayOfMonth: 1 },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /:orgId/templates/recurring/due ───────────────────

  describe("GET /:orgId/templates/recurring/due", () => {
    it("returns due recurring templates", async () => {
      const dueTemplate = {
        ...sampleTemplate,
        isRecurring: true,
        frequency: "MONTHLY" as const,
        dayOfMonth: 1,
        nextRunDate: new Date("2024-12-01"),
      };
      repos.voucherTemplates.findDueRecurring.mockResolvedValue([dueTemplate]);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}/recurring/due`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].isRecurring).toBe(true);
    });

    it("returns empty list when no templates are due", async () => {
      repos.voucherTemplates.findDueRecurring.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `${baseUrl}/recurring/due`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(0);
    });
  });

  // ── POST /:orgId/templates/recurring/execute ──────────────

  describe("POST /:orgId/templates/recurring/execute", () => {
    const dueTemplate = {
      ...sampleTemplate,
      isRecurring: true,
      frequency: "MONTHLY" as const,
      dayOfMonth: 15,
      nextRunDate: new Date("2024-12-15"),
    };

    it("returns empty result when no templates are due", async () => {
      repos.voucherTemplates.findDueRecurring.mockResolvedValue([]);

      const res = await app.inject({
        method: "POST",
        url: `${baseUrl}/recurring/execute`,
        payload: { fiscalYearId: "fy-1" },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.vouchersCreated).toBe(0);
      expect(body.data.errors).toHaveLength(0);
    });

    it("creates vouchers from due templates", async () => {
      repos.voucherTemplates.findDueRecurring.mockResolvedValue([dueTemplate]);
      repos.vouchers.create.mockResolvedValue(
        ok({ id: "v-1", voucherNumber: 1, date: new Date(), lines: [] }),
      );
      repos.voucherTemplates.markRecurringRun.mockResolvedValue(undefined);

      const res = await app.inject({
        method: "POST",
        url: `${baseUrl}/recurring/execute`,
        payload: { fiscalYearId: "fy-1" },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.vouchersCreated).toBe(1);
      expect(repos.vouchers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          fiscalYearId: "fy-1",
          description: "Månadshyra",
        }),
      );
      expect(repos.voucherTemplates.markRecurringRun).toHaveBeenCalled();
    });

    it("reports errors for failed voucher creation", async () => {
      repos.voucherTemplates.findDueRecurring.mockResolvedValue([dueTemplate]);
      repos.vouchers.create.mockResolvedValue(
        err({ code: "INVALID", message: "Ogiltigt verifikat" }),
      );

      const res = await app.inject({
        method: "POST",
        url: `${baseUrl}/recurring/execute`,
        payload: { fiscalYearId: "fy-1" },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.data.vouchersCreated).toBe(0);
      expect(body.data.errors).toHaveLength(1);
      expect(body.data.errors[0]).toContain("Månadshyra");
    });

    it("returns 400 without fiscalYearId", async () => {
      const res = await app.inject({
        method: "POST",
        url: `${baseUrl}/recurring/execute`,
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
