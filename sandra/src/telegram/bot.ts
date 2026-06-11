import { Telegraf } from "telegraf";

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

if (!telegramBotToken) {
  throw new Error("Telegram_BOT_TOKEN is missing");
}

export const bot = new Telegraf(telegramBotToken);