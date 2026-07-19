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

const createMessageSchema = z
  .object({
    receiverId: z.string().uuid(),
    imageUrl: z.string().url().optional(),
    imageWidth: z.number().int().positive().optional(),
    imageHeight: z.number().int().positive().optional(),
    text: z.string().trim().min(1).max(1000).optional(),
  })
  .refine((data) => Boolean(data.imageUrl) !== Boolean(data.text), {
    message: "Provide either imageUrl or text, not both",
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
        text: body.text,
      },
      include: {
        sender: { select: userPreviewSelect },
        receiver: { select: userPreviewSelect },
      },
    });

    res.status(201).json({ message });

    if (receiver.pushToken && receiver.notificationsEnabled) {
      void sendPushNotification({
        userId: receiver.id,
        pushToken: receiver.pushToken,
        title: message.text ? message.sender.name : "New photo",
        body: message.text ? message.text : `${message.sender.name} sent you a photo`,
        data: { type: "new_message", otherUserId: message.senderId },
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

const reactionSchema = z.object({
  emoji: z.string().trim().min(1).max(8).nullable(),
});

messagesRouter.patch(
  "/:id/reaction",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { emoji } = reactionSchema.parse(req.body);

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) {
      throw new HttpError(404, "Message not found");
    }
    if (message.receiverId !== req.userId) {
      throw new HttpError(403, "Only the receiver can react to this message");
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { reaction: emoji },
      include: {
        sender: { select: userPreviewSelect },
        receiver: { select: userPreviewSelect },
      },
    });

    res.json({ message: updated });

    if (emoji) {
      const sender = await prisma.user.findUnique({ where: { id: message.senderId } });
      if (sender?.pushToken && sender.notificationsEnabled) {
        void sendPushNotification({
          userId: sender.id,
          pushToken: sender.pushToken,
          title: "New reaction",
          body: `${updated.receiver.name} reacted ${emoji} to your message`,
          data: { type: "reaction", messageId: updated.id, otherUserId: updated.receiverId },
        });
      }
    }
  })
);

const replySchema = z.object({
  text: z.string().trim().min(1).max(500).nullable(),
});

// A hidden reply attached to the message itself (like a reaction, but text) -
// only the receiver can set it, and it stays hidden from the list view until
// the recipient taps to reveal it.
messagesRouter.patch(
  "/:id/reply",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { text } = replySchema.parse(req.body);

    const message = await prisma.message.findUnique({ where: { id } });
    if (!message) {
      throw new HttpError(404, "Message not found");
    }
    if (message.receiverId !== req.userId) {
      throw new HttpError(403, "Only the receiver can reply to this message");
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { replyText: text },
      include: {
        sender: { select: userPreviewSelect },
        receiver: { select: userPreviewSelect },
      },
    });

    res.json({ message: updated });

    if (text) {
      const sender = await prisma.user.findUnique({ where: { id: message.senderId } });
      if (sender?.pushToken && sender.notificationsEnabled) {
        void sendPushNotification({
          userId: sender.id,
          pushToken: sender.pushToken,
          title: "New reply",
          body: `${updated.receiver.name} replied to your photo`,
          data: { type: "reply", messageId: updated.id, otherUserId: updated.receiverId },
        });
      }
    }
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
