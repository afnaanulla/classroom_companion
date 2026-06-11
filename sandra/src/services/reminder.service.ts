import { prisma } from "../config/prisma";
import { ReminderScheduleItem } from "../types";
import { logger } from "../utils/logger";

export async function scheduleReminders(
  assignmentId: string,
  studentId: string,
  schedule: ReminderScheduleItem[]
) {
  const now = Date.now();

  const reminderData = schedule.map((item) => ({
    assignmentId,
    studentId,
    message: item.message,
    scheduledFor: new Date(now + item.delayHours * 60 * 60 * 1000),
    escalationLevel: item.escalationLevel as "GENTLE" | "MODERATE" | "URGENT" | "OVERDUE",
  }));

  await prisma.reminder.createMany({ data: reminderData });

  logger.info("ReminderService", `Scheduled ${reminderData.length} reminders`, {
    assignmentId,
    studentId,
  });
}

export async function getPendingReminders() {
  return prisma.reminder.findMany({
    where: {
      sentAt: null,
      scheduledFor: { lte: new Date() },
      retryCount: { lt: 3 },
    },
    include: {
      student: { include: { user: true } },
      assignment: true,
    },
    orderBy: { scheduledFor: "asc" },
  });
}

export async function markReminderAsSent(reminderId: string) {
  return prisma.reminder.update({
    where: { id: reminderId },
    data: { sentAt: new Date() },
  });
}

export async function incrementRetryCount(reminderId: string) {
  return prisma.reminder.update({
    where: { id: reminderId },
    data: { retryCount: { increment: 1 } },
  });
}

export async function getRemindersByAssignment(assignmentId: string) {
  return prisma.reminder.findMany({
    where: { assignmentId },
    orderBy: { scheduledFor: "asc" },
  });
}
