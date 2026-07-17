import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";

export const usersRouter = Router();

usersRouter.use(requireAuth);

const userSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
} as const;

usersRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: userSelect });
    res.json({ user });
  })
);

const pushTokenSchema = z.object({
  pushToken: z.string().min(1).max(255),
});

usersRouter.patch(
  "/me/push-token",
  asyncHandler(async (req, res) => {
    const { pushToken } = pushTokenSchema.parse(req.body);
    await prisma.user.update({ where: { id: req.userId }, data: { pushToken } });
    res.status(204).send();
  })
);

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { id: { not: req.userId } },
      select: userSelect,
      orderBy: { name: "asc" },
      take: 100,
    });
    res.json({ users });
  })
);

const searchSchema = z.object({
  q: z.string().trim().min(1).max(50),
});

usersRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    const { q } = searchSchema.parse(req.query);
    const users = await prisma.user.findMany({
      where: {
        id: { not: req.userId },
        username: { contains: q, mode: "insensitive" },
      },
      select: userSelect,
      take: 20,
      orderBy: { username: "asc" },
    });
    res.json({ users });
  })
);
