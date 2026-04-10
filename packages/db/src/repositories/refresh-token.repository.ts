import type { PrismaClient } from "../generated/prisma/client.js";
import type { IRefreshTokenRepository } from "@muninsbok/core/types";

export class RefreshTokenRepository implements IRefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(userId: string, jti: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, jti, expiresAt },
    });
  }

  async existsByJti(jti: string): Promise<boolean> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { jti },
      select: { id: true },
    });
    return token !== null;
  }

  async revokeByJti(jti: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { jti },
    });
  }

  async revokeByJtiIfExists(jti: string): Promise<boolean> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { jti },
    });
    return result.count > 0;
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
