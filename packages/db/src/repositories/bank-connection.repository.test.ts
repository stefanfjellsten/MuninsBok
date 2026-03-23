import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { BankConnectionRepository } from "./bank-connection.repository.js";

function createRepoWithMocks() {
  const findMany = vi.fn();
  const findFirst = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const del = vi.fn();

  const prisma = {
    bankConnection: {
      findMany,
      findFirst,
      create,
      update,
      delete: del,
    },
  } as unknown as PrismaClient;

  return {
    repo: new BankConnectionRepository(prisma),
    mocks: { findMany, findFirst, create, update, del },
  };
}

describe("BankConnectionRepository", () => {
  it("create returns duplicate error for unique conflicts", async () => {
    const { repo, mocks } = createRepoWithMocks();

    const duplicateError = Object.create(
      Prisma.PrismaClientKnownRequestError.prototype,
    ) as Prisma.PrismaClientKnownRequestError;
    Object.assign(duplicateError, {
      code: "P2002",
      message: "Unique constraint failed",
      clientVersion: "test",
      name: "PrismaClientKnownRequestError",
    });

    mocks.create.mockRejectedValue(duplicateError);

    const result = await repo.create("org-1", {
      provider: "sandbox",
      externalConnectionId: "ext-1",
      displayName: "Sandboxkonto",
      status: "CONNECTED",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("DUPLICATE_CONNECTION");
  });

  it("create succeeds and maps bank connection", async () => {
    const { repo, mocks } = createRepoWithMocks();
    const now = new Date("2026-01-01T00:00:00.000Z");

    mocks.create.mockResolvedValue({
      id: "bc-1",
      organizationId: "org-1",
      provider: "sandbox",
      externalConnectionId: "ext-1",
      displayName: "Sandboxkonto",
      accountName: null,
      accountIban: null,
      accountLast4: null,
      currency: "SEK",
      status: "CONNECTED",
      authExpiresAt: null,
      lastSyncedAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      metadata: { source: "test" },
      createdAt: now,
      updatedAt: now,
    });

    const result = await repo.create("org-1", {
      provider: "sandbox",
      externalConnectionId: "ext-1",
      displayName: "Sandboxkonto",
      status: "CONNECTED",
      metadata: { source: "test" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.id).toBe("bc-1");
    expect(result.value.externalConnectionId).toBe("ext-1");
    expect(result.value.metadata).toEqual({ source: "test" });
  });
});
