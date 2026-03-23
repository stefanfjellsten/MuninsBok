import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { BankTransactionMatchStatus } from "@muninsbok/core/types";
import { AppError } from "../utils/app-error.js";
import { parseBody } from "../utils/parse-body.js";
import {
  bankConnectInitSchema,
  bankConnectCallbackSchema,
  bankSyncBodySchema,
  bankWebhookCreateSchema,
  bankWebhookListQuerySchema,
} from "../schemas/index.js";

export async function bankRoutes(fastify: FastifyInstance) {
  const adapter = fastify.bankAdapter;
  const bankSync = fastify.bankSync;

  // POST /:orgId/bank/connect/init — generate OAuth authorization URL
  fastify.post<{ Params: { orgId: string } }>("/:orgId/bank/connect/init", async (request) => {
    const body = parseBody(bankConnectInitSchema, request.body);
    const state = randomUUID();
    const result = await adapter.createAuthorizationUrl({
      organizationId: request.params.orgId,
      connectionExternalId: body.externalConnectionId,
      redirectUri: body.redirectUri,
      state,
    });
    return { data: result };
  });

  // POST /:orgId/bank/connect/callback — exchange auth code and persist connection
  fastify.post<{ Params: { orgId: string } }>(
    "/:orgId/bank/connect/callback",
    async (request, reply) => {
      const body = parseBody(bankConnectCallbackSchema, request.body);
      const tokenSet = await adapter.exchangeAuthorizationCode({
        code: body.code,
        redirectUri: body.redirectUri,
      });

      const result = await fastify.repos.bankConnections.create(request.params.orgId, {
        provider: adapter.provider,
        externalConnectionId: body.externalConnectionId,
        ...(body.displayName != null && { displayName: body.displayName }),
        currency: "SEK",
        status: "CONNECTED",
        authExpiresAt: tokenSet.expiresAt,
        metadata: {
          auth: {
            accessToken: tokenSet.accessToken,
            refreshToken: tokenSet.refreshToken,
            expiresAt: tokenSet.expiresAt.toISOString(),
            tokenType: tokenSet.tokenType,
            scope: tokenSet.scope,
          },
        },
      });

      if (!result.ok) {
        if (result.error.code === "DUPLICATE_CONNECTION") {
          throw AppError.conflict(result.error.message);
        }
        throw AppError.badRequest(result.error.message, result.error.code);
      }

      // Strip auth metadata before returning
      const { metadata: _metadata, ...safeConnection } = result.value;
      return reply.status(201).send({ data: safeConnection });
    },
  );

  // POST /:orgId/bank/:connectionId/sync — trigger a manual sync
  fastify.post<{ Params: { orgId: string; connectionId: string } }>(
    "/:orgId/bank/:connectionId/sync",
    async (request) => {
      const body = parseBody(bankSyncBodySchema, request.body ?? {});
      const { orgId, connectionId } = request.params;

      const syncResult = await bankSync.syncConnection({
        organizationId: orgId,
        connectionId,
        trigger: "MANUAL",
        ...(body.fromDate != null && { fromDate: new Date(body.fromDate) }),
        ...(body.toDate != null && { toDate: new Date(body.toDate) }),
        ...(body.pageSize != null && { pageSize: body.pageSize }),
      });

      return { data: syncResult };
    },
  );

  // GET /:orgId/bank/connections — list all connections (auth metadata stripped)
  fastify.get<{ Params: { orgId: string } }>("/:orgId/bank/connections", async (request) => {
    const connections = await fastify.repos.bankConnections.findByOrganization(
      request.params.orgId,
    );
    const safe = connections.map(({ metadata: _metadata, ...rest }) => rest);
    return { data: safe };
  });

  // GET /:orgId/bank/:connectionId/transactions — paginated transaction list
  fastify.get<{
    Params: { orgId: string; connectionId: string };
    Querystring: {
      page?: string;
      limit?: string;
      fromDate?: string;
      toDate?: string;
      matchStatus?: string;
    };
  }>("/:orgId/bank/:connectionId/transactions", async (request, reply) => {
    const { orgId, connectionId } = request.params;
    const q = request.query;

    const connection = await fastify.repos.bankConnections.findById(connectionId, orgId);
    if (!connection) {
      return reply.status(404).send({ error: "Bankkopplingen hittades inte" });
    }

    return fastify.repos.bankTransactions.findByConnectionPaginated(connectionId, orgId, {
      page: q.page != null ? parseInt(q.page, 10) : 1,
      limit: q.limit != null ? parseInt(q.limit, 10) : 20,
      ...(q.fromDate != null && { fromDate: new Date(q.fromDate) }),
      ...(q.toDate != null && { toDate: new Date(q.toDate) }),
      ...(q.matchStatus != null && {
        matchStatus: q.matchStatus as BankTransactionMatchStatus,
      }),
    });
  });

  // POST /:orgId/bank/webhooks — ingest provider webhook event
  fastify.post<{ Params: { orgId: string } }>("/:orgId/bank/webhooks", async (request) => {
    const body = parseBody(bankWebhookCreateSchema, request.body);
    const orgId = request.params.orgId;

    const created = await fastify.repos.bankWebhookEvents.create({
      organizationId: orgId,
      ...(body.connectionId != null && { connectionId: body.connectionId }),
      provider: body.provider,
      providerEventId: body.providerEventId,
      eventType: body.eventType,
      ...(body.signatureValidated != null && {
        signatureValidated: body.signatureValidated,
      }),
      payload: body.payload,
      ...(body.receivedAt != null && { receivedAt: new Date(body.receivedAt) }),
    });

    if (!created.ok) {
      if (created.error.code === "DUPLICATE_PROVIDER_EVENT") {
        return {
          data: {
            duplicate: true,
            provider: body.provider,
            providerEventId: body.providerEventId,
          },
        };
      }
      throw AppError.badRequest(created.error.message, created.error.code);
    }

    const connectionId = body.connectionId;
    const shouldSync = connectionId != null && body.eventType.startsWith("transactions.");

    if (!shouldSync) {
      return { data: { eventId: created.value.id, processed: false } };
    }

    try {
      const syncResult = await bankSync.syncConnection({
        organizationId: orgId,
        connectionId,
        trigger: "WEBHOOK",
      });

      await fastify.repos.bankWebhookEvents.update(created.value.id, orgId, {
        status: "PROCESSED",
        processedAt: new Date(),
      });

      return {
        data: {
          eventId: created.value.id,
          processed: true,
          sync: syncResult,
        },
      };
    } catch (error) {
      await fastify.repos.bankWebhookEvents.update(created.value.id, orgId, {
        status: "FAILED",
        processedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Okänt fel",
      });

      return {
        data: {
          eventId: created.value.id,
          processed: true,
          sync: {
            status: "FAILED",
          },
        },
      };
    }
  });

  // GET /:orgId/bank/webhooks — list recent webhook events
  fastify.get<{
    Params: { orgId: string };
    Querystring: { limit?: string | number };
  }>("/:orgId/bank/webhooks", async (request) => {
    const query = parseBody(bankWebhookListQuerySchema, request.query ?? {});
    const limit = query.limit ?? 20;
    const events = await fastify.repos.bankWebhookEvents.listRecentByOrganization(
      request.params.orgId,
      limit,
    );

    return { data: events };
  });
}
