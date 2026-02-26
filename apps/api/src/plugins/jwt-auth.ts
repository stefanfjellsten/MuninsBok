/**
 * JWT authentication plugin.
 *
 * Wraps @fastify/jwt to provide:
 * - Access tokens  (short-lived, default 15 min)
 * - Refresh tokens (long-lived, default 7 days)
 * - `authenticate` request decorator (preHandler)
 *
 * Token payload shape: { sub: string; email: string; type: "access" | "refresh" }
 *
 * Usage in routes:
 *   fastify.get("/me", { preHandler: [fastify.authenticate] }, handler)
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import jwt from "@fastify/jwt";

export interface JwtPayload {
  /** User id */
  sub: string;
  /** User email */
  email: string;
  /** Token type to prevent cross-use */
  type: "access" | "refresh";
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtAuthOptions {
  /** Secret key for signing tokens. Must be ≥ 32 chars in production. */
  secret: string;
  /** Access token TTL (default: "15m") */
  accessTokenTtl?: string;
  /** Refresh token TTL (default: "7d") */
  refreshTokenTtl?: string;
}

async function jwtAuth(fastify: FastifyInstance, options: JwtAuthOptions): Promise<void> {
  const accessTtl = options.accessTokenTtl ?? "15m";
  const refreshTtl = options.refreshTokenTtl ?? "7d";

  await fastify.register(jwt, {
    secret: options.secret,
  });

  /** Generate an access + refresh token pair for a user. */
  fastify.decorate("generateTokens", function (userId: string, email: string): AuthTokens {
    const accessToken = fastify.jwt.sign(
      { sub: userId, email, type: "access" } satisfies JwtPayload,
      { expiresIn: accessTtl },
    );
    const refreshToken = fastify.jwt.sign(
      { sub: userId, email, type: "refresh" } satisfies JwtPayload,
      { expiresIn: refreshTtl },
    );
    return { accessToken, refreshToken };
  });

  /** PreHandler that verifies an access token and sets request.user. */
  fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      const decoded = await request.jwtVerify<JwtPayload>();

      if (decoded.type !== "access") {
        return reply.status(401).send({
          error: "Ogiltig tokentyp",
          code: "INVALID_TOKEN_TYPE",
        });
      }

      // Attach user info for downstream handlers
      request.user = decoded;
    } catch {
      return reply.status(401).send({
        error: "Ogiltig eller utgången token",
        code: "UNAUTHORIZED",
      });
    }
  });

  /**
   * PreHandler that verifies a refresh token (for the /auth/refresh endpoint).
   * Sets request.user with the refresh token payload.
   */
  fastify.decorate(
    "verifyRefreshToken",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const decoded = await request.jwtVerify<JwtPayload>();

        if (decoded.type !== "refresh") {
          return reply.status(401).send({
            error: "Ogiltig tokentyp — förväntade refresh-token",
            code: "INVALID_TOKEN_TYPE",
          });
        }

        request.user = decoded;
      } catch {
        return reply.status(401).send({
          error: "Ogiltig eller utgången refresh-token",
          code: "UNAUTHORIZED",
        });
      }
    },
  );
}

export default fp(jwtAuth, { name: "jwt-auth" });

// Augment Fastify types
declare module "fastify" {
  interface FastifyInstance {
    generateTokens: (userId: string, email: string) => AuthTokens;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    verifyRefreshToken: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
