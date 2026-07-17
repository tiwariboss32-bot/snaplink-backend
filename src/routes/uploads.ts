import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { getImageKit } from "../lib/imagekit";
import { HttpError } from "../middleware/errorHandler";
import { asyncHandler } from "../utils/asyncHandler";

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

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
