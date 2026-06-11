import "dotenv/config";
import express from "express";
import cors from "cors";

import { prisma } from "./config/prisma";
import { bot } from "./telegram/bot";
import "./telegram/registerHandlers";
import { teacherRouter } from "./routes/teacher.routes";
import { studentRouter } from "./routes/student.routes";
import { startReminderWorker } from "./jobs/reminderWorker";
import { logger } from "./utils/logger";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use("/uploads", express.static("uploads"));

const PORT = process.env.PORT || 3000;

// ── Health check ──
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      database: "connected",
      message: "Classroom Companion API is running",
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: "Database connection failed",
      timestamp: new Date().toISOString(),
    });
  }
});

// ── API routes ──
app.use("/api/teacher", teacherRouter);
app.use("/api/student", studentRouter);

// ── Start server ──
app.listen(PORT, () => {
  logger.info("Server", `API server running on port ${PORT}`);
});

// ── Start Telegram bot ──
bot.launch().catch((error) => {
  logger.error("TelegramBot", "Failed to start bot", { error: String(error) });
});
logger.info("TelegramBot", "Telegram bot started");

// ── Start reminder worker ──
startReminderWorker();

// ── Graceful shutdown ──
async function shutdown(signal: string) {
  logger.info("Server", `Received ${signal}, shutting down...`);
  bot.stop(signal);
  await prisma.$disconnect();
  process.exit(0);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));