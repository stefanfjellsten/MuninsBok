import type { FastifyInstance } from "fastify";
import {
  createCustomerSchema,
  updateCustomerSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceStatusSchema,
} from "../schemas/index.js";
import { parseBody } from "../utils/parse-body.js";
import { canTransitionTo } from "@muninsbok/core";

export async function invoiceRoutes(fastify: FastifyInstance) {
  const customerRepo = fastify.repos.customers;
  const invoiceRepo = fastify.repos.invoices;

  // ── Customers ─────────────────────────────────────────────

  // List all customers
  fastify.get<{ Params: { orgId: string } }>("/:orgId/customers", async (request) => {
    const customers = await customerRepo.findByOrganization(request.params.orgId);
    return { data: customers };
  });

  // Get single customer
  fastify.get<{ Params: { orgId: string; customerId: string } }>(
    "/:orgId/customers/:customerId",
    async (request, reply) => {
      const customer = await customerRepo.findById(request.params.customerId, request.params.orgId);
      if (!customer) {
        return reply.status(404).send({ error: "Kunden hittades inte" });
      }
      return { data: customer };
    },
  );

  // Create customer
  fastify.post<{ Params: { orgId: string } }>("/:orgId/customers", async (request, reply) => {
    const input = parseBody(createCustomerSchema, request.body);
    const result = await customerRepo.create(request.params.orgId, input);

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.status(201).send({ data: result.value });
  });

  // Update customer
  fastify.put<{ Params: { orgId: string; customerId: string } }>(
    "/:orgId/customers/:customerId",
    async (request, reply) => {
      const input = parseBody(updateCustomerSchema, request.body);
      const result = await customerRepo.update(
        request.params.customerId,
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

  // Delete customer
  fastify.delete<{ Params: { orgId: string; customerId: string } }>(
    "/:orgId/customers/:customerId",
    async (request, reply) => {
      const deleted = await customerRepo.delete(request.params.customerId, request.params.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: "Kunden hittades inte" });
      }
      return reply.status(204).send();
    },
  );

  // ── Invoices ──────────────────────────────────────────────

  // List all invoices
  fastify.get<{ Params: { orgId: string }; Querystring: { status?: string } }>(
    "/:orgId/invoices",
    async (request) => {
      const { status } = request.query;
      if (status) {
        const invoices = await invoiceRepo.findByStatus(request.params.orgId, status);
        return { data: invoices };
      }
      const invoices = await invoiceRepo.findByOrganization(request.params.orgId);
      return { data: invoices };
    },
  );

  // Get single invoice
  fastify.get<{ Params: { orgId: string; invoiceId: string } }>(
    "/:orgId/invoices/:invoiceId",
    async (request, reply) => {
      const invoice = await invoiceRepo.findById(request.params.invoiceId, request.params.orgId);
      if (!invoice) {
        return reply.status(404).send({ error: "Fakturan hittades inte" });
      }
      return { data: invoice };
    },
  );

  // List invoices by customer
  fastify.get<{ Params: { orgId: string; customerId: string } }>(
    "/:orgId/customers/:customerId/invoices",
    async (request) => {
      const invoices = await invoiceRepo.findByCustomer(
        request.params.customerId,
        request.params.orgId,
      );
      return { data: invoices };
    },
  );

  // Create invoice
  fastify.post<{ Params: { orgId: string } }>("/:orgId/invoices", async (request, reply) => {
    const input = parseBody(createInvoiceSchema, request.body);
    const result = await invoiceRepo.create(request.params.orgId, input);

    if (!result.ok) {
      return reply.status(400).send({ error: result.error });
    }
    return reply.status(201).send({ data: result.value });
  });

  // Update invoice (only DRAFT)
  fastify.put<{ Params: { orgId: string; invoiceId: string } }>(
    "/:orgId/invoices/:invoiceId",
    async (request, reply) => {
      const input = parseBody(updateInvoiceSchema, request.body);
      const result = await invoiceRepo.update(
        request.params.invoiceId,
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

  // Update invoice status (send, pay, cancel, etc.)
  fastify.post<{ Params: { orgId: string; invoiceId: string } }>(
    "/:orgId/invoices/:invoiceId/status",
    async (request, reply) => {
      const { status, paidDate } = parseBody(invoiceStatusSchema, request.body);

      // Validate the invoice exists
      const invoice = await invoiceRepo.findById(request.params.invoiceId, request.params.orgId);
      if (!invoice) {
        return reply.status(404).send({ error: "Fakturan hittades inte" });
      }

      // Validate transition
      if (!canTransitionTo(invoice.status, status)) {
        return reply.status(400).send({
          error: {
            code: "INVALID_STATUS",
            message: `Kan inte ändra status från ${invoice.status} till ${status}`,
          },
        });
      }

      const extra: { paidDate?: Date; sentAt?: Date } = {};
      if (status === "SENT") {
        extra.sentAt = new Date();
      }
      if (status === "PAID") {
        extra.paidDate = paidDate ?? new Date();
      }

      const result = await invoiceRepo.updateStatus(
        request.params.invoiceId,
        request.params.orgId,
        status,
        extra,
      );

      if (!result.ok) {
        return reply.status(400).send({ error: result.error });
      }
      return { data: result.value };
    },
  );

  // Delete invoice (only DRAFT)
  fastify.delete<{ Params: { orgId: string; invoiceId: string } }>(
    "/:orgId/invoices/:invoiceId",
    async (request, reply) => {
      const deleted = await invoiceRepo.delete(request.params.invoiceId, request.params.orgId);
      if (!deleted) {
        return reply.status(404).send({ error: "Fakturan hittades inte eller kan inte raderas" });
      }
      return reply.status(204).send();
    },
  );
}
