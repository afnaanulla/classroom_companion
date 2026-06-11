import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/errors";

interface CreateSubmissionInput {
  assignmentId: string;
  studentId: string;
  textContent: string;
  filePath?: string;
}

export async function createSubmission(input: CreateSubmissionInput) {
  const submission = await prisma.submission.create({
    data: {
      textContent: input.textContent,
      filePath: input.filePath ?? null,
      assignmentId: input.assignmentId,
      studentId: input.studentId,
    },
  });

  // Update assignment status to SUBMITTED
  await prisma.assignment.update({
    where: { id: input.assignmentId },
    data: { status: "SUBMITTED" },
  });

  return submission;
}

export async function getSubmissionsByAssignment(assignmentId: string) {
  return prisma.submission.findMany({
    where: { assignmentId },
    include: { student: { include: { user: true } } },
    orderBy: { submittedAt: "desc" },
  });
}

export async function getSubmissionsByStudent(studentTelegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: studentTelegramId },
    include: { studentProfile: true },
  });

  if (!user?.studentProfile) {
    throw new NotFoundError("Student not found.");
  }

  return prisma.submission.findMany({
    where: { studentId: user.studentProfile.id },
    include: { assignment: true },
    orderBy: { submittedAt: "desc" },
  });
}

export async function markSubmissionAsReviewed(submissionId: string) {
  return prisma.submission.update({
    where: { id: submissionId },
    data: { reviewed: true },
  });
}
