/**
 * Audit logging plugin.
 *
 * Logs every mutating request (POST / PUT / PATCH / DELETE) with structured
 * data for traceability and compliance. The audit record includes:
 *
 * - requestId (from the request-logging plugin)
 * - method & url
 * - status code
 * - duration
 * - timestamp
 *
 * In a future auth iteration the record will also include the authenticated
 * user id.  For now the logging goes through Pino (same as request-logging)
 * so it ends up in the structured log stream and can be shipped to any SIEM.
 */
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function auditLogging(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("onResponse", async (request, reply) => {
    if (!WRITE_METHODS.has(request.method)) return;

    request.log.info(
      {
        audit: true,
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        timestamp: new Date().toISOString(),
      },
      "audit: write operation",
    );
  });
}

export default fp(auditLogging, { name: "audit-logging" });
