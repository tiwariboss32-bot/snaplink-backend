import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./lib/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { messagesRouter } from "./routes/messages";
import { uploadsRouter } from "./routes/uploads";
import { usersRouter } from "./routes/users";

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(
      `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms) content-type=${req.headers["content-type"]}`
    );
  });
  next();
});

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authLimiter, authRouter);
app.use("/users", apiLimiter, usersRouter);
app.use("/messages", apiLimiter, messagesRouter);
app.use("/uploads", apiLimiter, uploadsRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`SnapLink API listening on http://localhost:${env.port}`);
});
