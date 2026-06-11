import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/errors";

interface CreateFeedbackInput {
  assignmentId: string;
  teacherId: string;
  message: string;
}

export async function createFeedback(input: CreateFeedbackInput) {
  const feedback = await prisma.feedback.create({
    data: {
      message: input.message,
      assignmentId: input.assignmentId,
      teacherId: input.teacherId,
    },
  });

  // Update assignment status to FEEDBACK_GIVEN
  await prisma.assignment.update({
    where: { id: input.assignmentId },
    data: { status: "FEEDBACK_GIVEN" },
  });

  return feedback;
}

export async function getFeedbackForAssignment(assignmentId: string) {
  return prisma.feedback.findMany({
    where: { assignmentId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFeedbackHistory(studentTelegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: studentTelegramId },
    include: { studentProfile: true },
  });

  if (!user?.studentProfile) {
    throw new NotFoundError("Student not found.");
  }

  return prisma.feedback.findMany({
    where: {
      assignment: { studentId: user.studentProfile.id },
    },
    include: {
      assignment: true,
      teacher: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function markFeedbackAsRead(feedbackId: string) {
  return prisma.feedback.update({
    where: { id: feedbackId },
    data: { readAt: new Date() },
  });
}
