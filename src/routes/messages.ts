import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { HttpError } from "../middleware/errorHandler";
import { sendPushNotification } from "../lib/pushNotifications";
import { asyncHandler } from "../utils/asyncHandler";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

const userPreviewSelect = {
  id: true,
  name: true,
  username: true,
  avatarUrl: true,
} as const;

// GET /messages           -> latest messages involving the current user (inbox), newest first
// GET /messages?with=:id  -> full conversation thread with a specific user, newest first
messagesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const withUserId = typeof req.query.with === "string" ? req.query.with : undefined;

    const where = withUserId
      ? {
          OR: [
            { senderId: req.userId, receiverId: withUserId },
            { senderId: withUserId, receiverId: req.userId },
          ],
        }
      : {
          OR: [{ senderId: req.userId }, { receiverId: req.userId }],
        };

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        sender: { select: userPreviewSelect },
        receiver: { select: userPreviewSelect },
      },
    });

    res.json({ messages });
  })
);

const createMessageSchema = z.object({
  receiverId: z.string().uuid(),
  imageUrl: z.string().url(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
});

messagesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createMessageSchema.parse(req.body);

    if (body.receiverId === req.userId) {
      throw new HttpError(400, "Cannot send a message to yourself");
    }

    const receiver = await prisma.user.findUnique({ where: { id: body.receiverId } });
    if (!receiver) {
      throw new HttpError(404, "Receiver not found");
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.userId!,
        receiverId: body.receiverId,
        imageUrl: body.imageUrl,
        imageWidth: body.imageWidth,
        imageHeight: body.imageHeight,
      },
      include: {
        sender: { select: userPreviewSelect },
        receiver: { select: userPreviewSelect },
      },
    });

    res.status(201).json({ message });

    if (receiver.pushToken) {
      void sendPushNotification(receiver.pushToken, "New photo", `${message.sender.name} sent you a photo`, {
        senderId: message.senderId,
      });
    }
  })
);

messagesRouter.patch(
  "/:id/seen",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) {
      throw new HttpError(404, "Message not found");
    }
    if (message.receiverId !== req.userId) {
      throw new HttpError(403, "Only the receiver can mark a message as seen");
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { isSeen: true },
    });

    res.json({ message: updated });
  })
);

messagesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) {
      throw new HttpError(404, "Message not found");
    }
    if (message.senderId !== req.userId && message.receiverId !== req.userId) {
      throw new HttpError(403, "Not authorized to delete this message");
    }

    await prisma.message.delete({ where: { id } });
    res.status(204).send();
  })
);
