import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp, type MockRepos } from "../test/helpers.js";
import type { IAggregatorBankAdapter } from "../services/bank-adapter.js";

describe("Bank routes", () => {
  let app: FastifyInstance;
  let repos: MockRepos;
  let bankAdapter: {
    [K in keyof IAggregatorBankAdapter]: IAggregatorBankAdapter[K] extends (
      ...args: infer _A
    ) => infer _R
      ? ReturnType<typeof import("vitest").vi.fn>
      : IAggregatorBankAdapter[K];
  };

  const orgId = "org-1";
  const connectionId = "conn-1";

  const mockConnection = {
    id: connectionId,
    organizationId: orgId,
    provider: "sandbox",
    externalConnectionId: "ext-conn-1",
    displayName: "Testbanken",
    currency: "SEK",
    status: "CONNECTED" as const,
    authExpiresAt: new Date("2026-12-31T23:59:59Z"),
    metadata: {
      auth: {
        accessToken: "sbx_at_test",
        refreshToken: "sbx_rt_test",
        expiresAt: new Date("2026-12-31T23:59:59Z").toISOString(),
        tokenType: "Bearer",
        scope: ["transactions"],
      },
    },
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  const mockSyncRun = {
    id: "run-1",
    organizationId: orgId,
    connectionId,
    trigger: "MANUAL" as const,
    status: "RUNNING" as const,
    startedAt: new Date("2026-03-19"),
    importedCount: 0,
    updatedCount: 0,
    failedCount: 0,
    createdAt: new Date("2026-03-19"),
    updatedAt: new Date("2026-03-19"),
  };

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
    repos = ctx.repos;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bankAdapter = ctx.bankAdapter as any;
  });

  // ── POST /connect/init ──────────────────────────────────────────────────────

  describe("POST /:orgId/bank/connect/init", () => {
    it("returns authorization URL from adapter", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/init`,
        payload: {
          externalConnectionId: "ext-conn-1",
          redirectUri: "https://app.example.com/bank/callback",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.authorizationUrl).toContain("sandbox.aggregator.local");
      expect(bankAdapter.createAuthorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: orgId,
          connectionExternalId: "ext-conn-1",
          redirectUri: "https://app.example.com/bank/callback",
        }),
      );
    });

    it("returns 400 on missing externalConnectionId", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/init`,
        payload: { redirectUri: "https://app.example.com/bank/callback" },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 400 on invalid redirectUri", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/init`,
        payload: { externalConnectionId: "ext-1", redirectUri: "not-a-url" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /connect/callback ──────────────────────────────────────────────────

  describe("POST /:orgId/bank/connect/callback", () => {
    const callbackPayload = {
      code: "sandbox-code-abc",
      externalConnectionId: "ext-conn-1",
      redirectUri: "https://app.example.com/bank/callback",
      displayName: "Testbanken",
    };

    it("creates connection and returns 201 without metadata", async () => {
      repos.bankConnections.create.mockResolvedValue({
        ok: true,
        value: mockConnection,
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/callback`,
        payload: callbackPayload,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.data.id).toBe(connectionId);
      // Auth metadata must not be included in response
      expect(body.data.metadata).toBeUndefined();
      expect(repos.bankConnections.create).toHaveBeenCalledWith(
        orgId,
        expect.objectContaining({
          provider: "sandbox",
          externalConnectionId: "ext-conn-1",
          displayName: "Testbanken",
          status: "CONNECTED",
        }),
      );
    });

    it("returns 409 on duplicate connection", async () => {
      repos.bankConnections.create.mockResolvedValue({
        ok: false,
        error: { code: "DUPLICATE_CONNECTION", message: "Anslutning finns redan" },
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/callback`,
        payload: callbackPayload,
      });

      expect(res.statusCode).toBe(409);
    });

    it("returns 400 on missing code", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/connect/callback`,
        payload: {
          externalConnectionId: "ext-conn-1",
          redirectUri: "https://app.example.com/bank/callback",
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /connections ────────────────────────────────────────────────────────

  describe("GET /:orgId/bank/connections", () => {
    it("returns connections without metadata", async () => {
      repos.bankConnections.findByOrganization.mockResolvedValue([mockConnection]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/connections`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe(connectionId);
      // Auth metadata must not be included
      expect(body.data[0].metadata).toBeUndefined();
    });

    it("returns empty array when no connections", async () => {
      repos.bankConnections.findByOrganization.mockResolvedValue([]);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/connections`,
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).data).toHaveLength(0);
    });
  });

  // ── GET /:connectionId/transactions ────────────────────────────────────────

  describe("GET /:orgId/bank/:connectionId/transactions", () => {
    const paginatedResult = {
      data: [
        {
          id: "tx-1",
          organizationId: orgId,
          connectionId,
          providerTransactionId: "sbx_tx_1",
          bookedAt: new Date("2026-03-01"),
          description: "ICA",
          amountOre: -12000,
          currency: "SEK",
          matchStatus: "PENDING_MATCH" as const,
          createdAt: new Date("2026-03-01"),
          updatedAt: new Date("2026-03-01"),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    it("returns paginated transactions", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankTransactions.findByConnectionPaginated.mockResolvedValue(paginatedResult);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/transactions`,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.total).toBe(1);
      expect(body.data[0].id).toBe("tx-1");
      expect(repos.bankTransactions.findByConnectionPaginated).toHaveBeenCalledWith(
        connectionId,
        orgId,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it("returns 404 when connection not found", async () => {
      repos.bankConnections.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/transactions`,
      });

      expect(res.statusCode).toBe(404);
    });

    it("passes pagination query params", async () => {
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankTransactions.findByConnectionPaginated.mockResolvedValue({
        ...paginatedResult,
        page: 2,
        limit: 10,
      });

      await app.inject({
        method: "GET",
        url: `/api/organizations/${orgId}/bank/${connectionId}/transactions?page=2&limit=10`,
      });

      expect(repos.bankTransactions.findByConnectionPaginated).toHaveBeenCalledWith(
        connectionId,
        orgId,
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ── POST /:connectionId/sync ────────────────────────────────────────────────

  describe("POST /:orgId/bank/:connectionId/sync", () => {
    beforeEach(() => {
      // Set up mocks for a successful sync with no transactions
      repos.bankConnections.findById.mockResolvedValue(mockConnection);
      repos.bankSyncRuns.create.mockResolvedValue(mockSyncRun);
      bankAdapter.fetchTransactions.mockResolvedValue({ transactions: [] });
      repos.bankSyncRuns.complete.mockResolvedValue({
        ...mockSyncRun,
        status: "SUCCEEDED" as const,
      });
      repos.bankConnections.update.mockResolvedValue({
        ok: true,
        value: mockConnection,
      });
    });

    it("runs a manual sync and returns result", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync`,
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.syncRunId).toBe("run-1");
      expect(body.data.fetched).toBe(0);
      expect(body.data.created).toBe(0);
      expect(body.data.updated).toBe(0);
      expect(repos.bankSyncRuns.create).toHaveBeenCalledWith(
        orgId,
        connectionId,
        expect.objectContaining({ trigger: "MANUAL" }),
      );
    });

    it("returns 404 when connection not found", async () => {
      repos.bankConnections.findById.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync`,
        payload: {},
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 on invalid pageSize", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/organizations/${orgId}/bank/${connectionId}/sync`,
        payload: { pageSize: 0 },
      });

      expect(res.statusCode).toBe(400);
    });
  });
});
