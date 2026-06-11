import cron from "node-cron";
import { getPendingReminders, markReminderAsSent, incrementRetryCount } from "../services/reminder.service";
import { bot } from "../telegram/bot";
import { logger } from "../utils/logger";

export function startReminderWorker(): void {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      const pendingReminders = await getPendingReminders();

      if (pendingReminders.length === 0) return;

      logger.info("ReminderWorker", `Processing ${pendingReminders.length} pending reminders`);

      for (const reminder of pendingReminders) {
        try {
          const telegramId = reminder.student.user.telegramId;
          const escalationEmoji =
            reminder.escalationLevel === "GENTLE" ? "📝" :
            reminder.escalationLevel === "MODERATE" ? "⏰" :
            reminder.escalationLevel === "URGENT" ? "🚨" : "⚠️";

          await bot.telegram.sendMessage(
            telegramId,
            `${escalationEmoji} *Reminder*\n\n${reminder.message}`,
            { parse_mode: "Markdown" }
          );

          await markReminderAsSent(reminder.id);
          logger.info("ReminderWorker", "Reminder sent", {
            reminderId: reminder.id,
            studentId: reminder.studentId,
          });
        } catch (sendError) {
          await incrementRetryCount(reminder.id);
          logger.error("ReminderWorker", "Failed to send reminder", {
            reminderId: reminder.id,
            error: String(sendError),
          });
        }
      }
    } catch (error) {
      logger.error("ReminderWorker", "Cron job failed", { error: String(error) });
    }
  });

  logger.info("ReminderWorker", "Reminder worker started (runs every 5 minutes)");
}
