import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp } from "../test/helpers.js";
import type { FastifyInstance } from "fastify";

const TEST_SECRET = "test-secret-that-is-long-enough-for-jwt";

describe("protected routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const result = await buildTestApp(undefined, { jwtSecret: TEST_SECRET });
    app = result.app;
    // Mock findAll so the org list endpoint has a valid response
    result.repos.organizations.findAll.mockResolvedValue([]);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Public routes remain accessible ─────────────────────────

  it("allows /health without token", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
  });

  it("allows /docs without token", async () => {
    const response = await app.inject({ method: "GET", url: "/docs/" });
    // Swagger UI returns 200 or 302
    expect(response.statusCode).toBeLessThan(400);
  });

  it("allows POST /api/auth/register without token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "not-valid", name: "", password: "short" },
    });
    // 400 from validation, not 401 — proves the route is accessible
    expect(response.statusCode).toBe(400);
  });

  it("allows POST /api/auth/login without token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "not-valid", password: "" },
    });
    // 400 from validation, not 401
    expect(response.statusCode).toBe(400);
  });

  // ── Org-scoped routes require authentication ────────────────

  it("rejects GET /api/organizations without token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/organizations",
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects GET /api/organizations/:orgId without token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/organizations/org-1",
    });
    expect(response.statusCode).toBe(401);
  });

  it("allows GET /api/organizations with valid token", async () => {
    const { accessToken } = app.generateTokens("user-1", "test@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/api/organizations",
      headers: { authorization: `Bearer ${accessToken}` },
    });

    // 200 (empty list) — proves the auth passed
    expect(response.statusCode).toBe(200);
  });

  it("rejects org-scoped routes with refresh token", async () => {
    const { refreshToken } = app.generateTokens("user-1", "test@example.com");

    const response = await app.inject({
      method: "GET",
      url: "/api/organizations",
      headers: { authorization: `Bearer ${refreshToken}` },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "INVALID_TOKEN_TYPE" });
  });
});
