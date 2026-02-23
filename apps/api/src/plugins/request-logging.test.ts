import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../test/helpers.js";

describe("Request logging plugin", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
  });

  it("returns X-Request-Id header on every response", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    const requestId = res.headers["x-request-id"];

    expect(requestId).toBeDefined();
    expect(typeof requestId).toBe("string");
    expect((requestId as string).length).toBeGreaterThan(0);
  });

  it("echoes client-supplied X-Request-Id", async () => {
    const clientId = "my-trace-abc-123";
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": clientId },
    });

    expect(res.headers["x-request-id"]).toBe(clientId);
  });

  it("includes requestId in error responses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/organizations/nonexistent/dashboard?fiscalYearId=fy1",
    });

    const body = res.json();
    expect(body.requestId).toBeDefined();
    expect(typeof body.requestId).toBe("string");
  });
});
