import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { getImageKit } from "../lib/imagekit";
import { env } from "../lib/env";
import { getS3, publicUrlForKey } from "../lib/s3";
import { HttpError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const presignSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

// POST /uploads/presign -> a short-lived S3 PUT URL the client uploads the
// photo bytes to directly, bypassing this server entirely for the transfer.
uploadsRouter.post(
  "/presign",
  asyncHandler(async (req, res) => {
    const { contentType } = presignSchema.parse(req.body);
    const extension = ALLOWED_CONTENT_TYPES[contentType];
    const key = `snaplink/messages/${req.userId}-${Date.now()}-${randomUUID()}.${extension}`;

    const uploadUrl = await getSignedUrl(
      getS3(),
      new PutObjectCommand({ Bucket: env.aws.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 120 }
    );

    res.json({ uploadUrl, publicUrl: publicUrlForKey(key), key });
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new HttpError(400, "Only image uploads are allowed"));
      return;
    }
    cb(null, true);
  },
});

// POST /uploads/image (multipart form field "image") -> uploads to ImageKit, returns the URL + dimensions
uploadsRouter.post(
  "/image",
  upload.single("image"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, "No image file provided");
    }

    const result = await getImageKit().upload({
      file: req.file.buffer,
      fileName: `${req.userId}-${Date.now()}.jpg`,
      folder: "/snaplink/messages",
      useUniqueFileName: true,
    });

    res.status(201).json({
      url: result.url,
      width: result.width,
      height: result.height,
      fileId: result.fileId,
    });
  })
);
