import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../test/helpers.js";

describe("Helmet security headers", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("sets X-Frame-Options: SAMEORIGIN", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("removes X-Powered-By header", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("does not set Content-Security-Policy (disabled for API)", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.headers["content-security-policy"]).toBeUndefined();
  });
});
