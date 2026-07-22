import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";
import { signToken } from "../utils/jwt";
import { createRefreshToken, revokeRefreshToken, rotateRefreshToken } from "../utils/refreshToken";

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers, and underscores"),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { name, username, email, password } = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      throw new HttpError(409, "Email or username already in use");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, username, email, passwordHash },
    });

    const token = signToken({ userId: user.id });
    const refreshToken = await createRefreshToken(user.id);
    res.status(201).json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl },
    });
  })
);

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, "Invalid email or password");
    }

    const token = signToken({ userId: user.id });
    const refreshToken = await createRefreshToken(user.id);
    res.json({
      token,
      refreshToken,
      user: { id: user.id, name: user.name, username: user.username, email: user.email, avatarUrl: user.avatarUrl },
    });
  })
);

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    const rotated = await rotateRefreshToken(refreshToken);
    if (!rotated) {
      throw new HttpError(401, "Invalid or expired refresh token");
    }

    const token = signToken({ userId: rotated.userId });
    res.json({ token, refreshToken: rotated.token });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await revokeRefreshToken(refreshToken);
    res.status(204).send();
  })
);
