/**
 * Prometheus metrics route.
 *
 * Exposes `GET /metrics` returning all registered metrics in
 * Prometheus text exposition format.
 */
import type { FastifyInstance } from "fastify";

export async function metricsRoute(fastify: FastifyInstance): Promise<void> {
  fastify.get("/metrics", async (_request, reply) => {
    const metrics = await fastify.metricsRegistry.metrics();
    return reply.type(fastify.metricsRegistry.contentType).send(metrics);
  });
}
