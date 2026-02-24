import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../test/helpers.js";

describe("Rate limiting", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
  });

  it("includes rate-limit headers on responses", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
  });

  it("allows 100 GET requests per minute", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-ratelimit-limit"]).toBe("100");
  });

  it("allows only 30 POST requests per minute", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ name: "Test", orgNumber: "5591234567" }),
    });

    // POST succeeds (or fails validation) but rate-limit header should be 30
    expect(res.headers["x-ratelimit-limit"]).toBe("30");
  });
});
