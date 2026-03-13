import type { FastifyInstance } from "fastify";
import type { UpdateVoucherTemplateInput } from "@muninsbok/core/types";
import {
  createVoucherTemplateSchema,
  updateVoucherTemplateSchema,
  updateRecurringScheduleSchema,
  executeRecurringSchema,
} from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";

export async function voucherTemplateRoutes(fastify: FastifyInstance) {
  const templateRepo = fastify.repos.voucherTemplates;

  // List templates for organization
  fastify.get<{ Params: { orgId: string } }>("/:orgId/templates", async (request) => {
    const templates = await templateRepo.findByOrganization(request.params.orgId);
    return { data: templates };
  });

  // Get single template
  fastify.get<{ Params: { orgId: string; templateId: string } }>(
    "/:orgId/templates/:templateId",
    async (request, reply) => {
      const template = await templateRepo.findById(request.params.templateId, request.params.orgId);
      if (!template) {
        return reply.status(404).send({ error: "Mallen hittades inte" });
      }
      return { data: template };
    },
  );

  // Create template
  fastify.post<{ Params: { orgId: string } }>("/:orgId/templates", async (request, reply) => {
    const parsed = parseBody(createVoucherTemplateSchema, request.body);

    const result = await templateRepo.create(request.params.orgId, {
      name: parsed.name,
      ...(parsed.description != null && { description: parsed.description }),
      lines: parsed.lines.map((l) => ({
        accountNumber: l.accountNumber,
        debit: l.debit,
        credit: l.credit,
        ...(l.description != null && { description: l.description }),
      })),
    });

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({ data: result.value });
  });

  // Update template
  fastify.put<{ Params: { orgId: string; templateId: string } }>(
    "/:orgId/templates/:templateId",
    async (request, reply) => {
      const parsed = parseBody(updateVoucherTemplateSchema, request.body);

      const input: UpdateVoucherTemplateInput = {
        ...(parsed.name != null && { name: parsed.name }),
        // Only include description if it was explicitly sent (null → clear, string → set)
        ...(parsed.description !== undefined &&
          parsed.description !== null && { description: parsed.description }),
        ...(parsed.lines != null && {
          lines: parsed.lines.map((l) => ({
            accountNumber: l.accountNumber,
            debit: l.debit,
            credit: l.credit,
            ...(l.description != null && { description: l.description }),
          })),
        }),
      };

      const result = await templateRepo.update(
        request.params.templateId,
        request.params.orgId,
        input,
      );

      if (!result.ok) {
        const status = result.error.code === "NOT_FOUND" ? 404 : 400;
        return reply.status(status).send({ error: result.error });
      }

      return { data: result.value };
    },
  );

  // Delete template
  fastify.delete<{ Params: { orgId: string; templateId: string } }>(
    "/:orgId/templates/:templateId",
    async (request, reply) => {
      const deleted = await templateRepo.delete(request.params.templateId, request.params.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: "Mallen hittades inte" });
      }
      return reply.status(204).send();
    },
  );

  // ── Recurring template scheduling ─────────────────────────

  // Update recurring schedule on a template
  fastify.put<{ Params: { orgId: string; templateId: string } }>(
    "/:orgId/templates/:templateId/recurring",
    async (request, reply) => {
      const parsed = parseBody(updateRecurringScheduleSchema, request.body);

      if (parsed.isRecurring) {
        if (!parsed.frequency) {
          return reply.status(400).send({ error: "Frekvens krävs för återkommande mall" });
        }
        if (!parsed.dayOfMonth) {
          return reply.status(400).send({ error: "Dag i månaden krävs för återkommande mall" });
        }
      }

      const schedule: {
        isRecurring: boolean;
        frequency?: "MONTHLY" | "QUARTERLY";
        dayOfMonth?: number;
        nextRunDate?: Date;
        recurringEndDate?: Date | null;
      } = { isRecurring: parsed.isRecurring };

      if (parsed.frequency) schedule.frequency = parsed.frequency;
      if (parsed.dayOfMonth) schedule.dayOfMonth = parsed.dayOfMonth;
      if (parsed.nextRunDate) schedule.nextRunDate = new Date(parsed.nextRunDate);
      if (parsed.recurringEndDate === null) {
        schedule.recurringEndDate = null;
      } else if (parsed.recurringEndDate) {
        schedule.recurringEndDate = new Date(parsed.recurringEndDate);
      }

      const result = await templateRepo.updateRecurringSchedule(
        request.params.templateId,
        request.params.orgId,
        schedule,
      );

      if (!result) {
        return reply.status(404).send({ error: "Mallen hittades inte" });
      }

      return { data: result };
    },
  );

  // List templates that are due for execution
  fastify.get<{ Params: { orgId: string } }>("/:orgId/templates/recurring/due", async (request) => {
    const dueTemplates = await templateRepo.findDueRecurring(request.params.orgId, new Date());
    return { data: dueTemplates };
  });

  // Execute all due recurring templates (create vouchers)
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/templates/recurring/execute",
    async (request, reply) => {
      const parsed = parseBody(executeRecurringSchema, request.body);
      const voucherRepo = fastify.repos.vouchers;

      const dueTemplates = await templateRepo.findDueRecurring(request.params.orgId, new Date());

      if (dueTemplates.length === 0) {
        return { data: { vouchersCreated: 0, errors: [] } };
      }

      const errors: string[] = [];
      let vouchersCreated = 0;

      for (const tpl of dueTemplates) {
        const result = await voucherRepo.create({
          organizationId: request.params.orgId,
          fiscalYearId: parsed.fiscalYearId,
          date: new Date(),
          description: tpl.name,
          lines: tpl.lines.map((l) => ({
            accountNumber: l.accountNumber,
            debit: l.debit,
            credit: l.credit,
            ...(l.description != null && { description: l.description }),
          })),
        });

        if (result.ok) {
          vouchersCreated++;

          // Calculate next run date
          const nextRun = calculateNextRunDate(
            tpl.frequency ?? "MONTHLY",
            tpl.dayOfMonth ?? 1,
            tpl.nextRunDate ?? new Date(),
          );
          await templateRepo.markRecurringRun(tpl.id, nextRun);
        } else {
          errors.push(
            `${tpl.name}: ${typeof result.error === "string" ? result.error : result.error.message}`,
          );
        }
      }

      return reply.status(vouchersCreated > 0 ? 201 : 400).send({
        data: { vouchersCreated, errors },
      });
    },
  );
}

function calculateNextRunDate(
  frequency: "MONTHLY" | "QUARTERLY",
  dayOfMonth: number,
  fromDate: Date,
): Date {
  const next = new Date(fromDate);
  const monthsToAdd = frequency === "QUARTERLY" ? 3 : 1;
  next.setMonth(next.getMonth() + monthsToAdd);
  // Clamp day to valid range for the target month
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(dayOfMonth, maxDay));
  return next;
}
