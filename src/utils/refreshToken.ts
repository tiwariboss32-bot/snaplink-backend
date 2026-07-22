import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTokenExpiresInDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });

  return token;
}

// Single-use: validates the presented token, revokes it, and issues a
// replacement. This limits how long a leaked refresh token stays useful.
export async function rotateRefreshToken(presentedToken: string): Promise<{ userId: string; token: string } | null> {
  const tokenHash = hashToken(presentedToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const token = await createRefreshToken(existing.userId);
  return { userId: existing.userId, token };
}

export async function revokeRefreshToken(presentedToken: string): Promise<void> {
  const tokenHash = hashToken(presentedToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
