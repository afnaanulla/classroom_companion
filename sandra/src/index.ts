import "dotenv/config";
import express from "express";
import cors from "cors";

import { prisma } from "./config/prisma";
import "./telegram/registerHandlers";
import { bot } from "./telegram/bot";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/health", async (_request, response) => {
  try {
    await prisma.$connect();
    response.json({
      status: "ok",
      database: "connected",
      message: "Classroom Companion API is running"
    });
  }
  catch (error) {
    response.json({
      status: "error",
      database: "disconnected",
      message: "Classroom Companion API is not running"
    })
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

console.log("Starting Telegram bot...");
bot.launch().catch((error) => {
  console.error("Failed to start bot:", error);
});
console.log("Telegram bot is running...");

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));