import { describe, it, expect, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "../test/helpers.js";

describe("Input sanitization", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const ctx = await buildTestApp();
    app = ctx.app;
  });

  it("rejects payloads exceeding body limit with 413", async () => {
    // The body limit is set to 1 MB in app.ts
    const oversizedBody = "x".repeat(2 * 1024 * 1024); // 2 MB

    const res = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { "content-type": "application/json" },
      payload: oversizedBody,
    });

    expect(res.statusCode).toBe(413);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { "content-type": "application/json" },
      payload: "{ not valid json }}}",
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects unsupported content-type with 415", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/organizations",
      headers: { "content-type": "text/xml" },
      payload: "<xml>test</xml>",
    });

    expect(res.statusCode).toBe(415);
  });
});
