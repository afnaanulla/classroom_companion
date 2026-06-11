import { prisma } from "../config/prisma";
import { ValidationError, NotFoundError } from "../utils/errors";
import { generateReminderSchedule } from "../agents/ReminderAgent";
import { scheduleReminders } from "./reminder.service";

interface CreateAssignmentInput {
  teacherId: string;
  studentId: string;
  title: string;
  description: string;
  deadline: Date;
}

interface CreateProgressInput {
  assignmentId: string;
  studentId: string;
  message: string;
}

export async function createAssignment(input: CreateAssignmentInput) {
  if (input.deadline <= new Date()) {
    throw new ValidationError("Due date must be in the future.");
  }

  const assignment = await prisma.assignment.create({
    data: {
      title: input.title,
      description: input.description,
      deadline: input.deadline,
      teacherId: input.teacherId,
      studentId: input.studentId,
    },
    include: {
      student: { include: { user: true } },
      teacher: { include: { user: true } },
    },
  });

  // Schedule reminders via the Reminder Agent
  const hoursUntilDeadline = (input.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
  try {
    const schedule = await generateReminderSchedule(
      input.title,
      assignment.student.user.name,
      input.deadline.toISOString(),
      Math.round(hoursUntilDeadline)
    );

    if (schedule.length > 0) {
      await scheduleReminders(assignment.id, input.studentId, schedule);
    }
  } catch {
    // Reminder scheduling is non-critical; log but don't fail assignment creation
  }

  return assignment;
}

export async function getAssignmentsByTeacher(teacherTelegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: teacherTelegramId },
    include: { teacherProfile: true },
  });

  if (!user?.teacherProfile) {
    throw new NotFoundError("Teacher not found.");
  }

  return prisma.assignment.findMany({
    where: { teacherId: user.teacherProfile.id },
    include: {
      student: { include: { user: true } },
      submissions: { orderBy: { submittedAt: "desc" } },
      feedbacks: { orderBy: { createdAt: "desc" } },
      progressUpdates: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { deadline: "asc" },
  });
}

export async function getAssignmentsByStudent(studentTelegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: studentTelegramId },
    include: { studentProfile: true },
  });

  if (!user?.studentProfile) {
    throw new NotFoundError("Student not found.");
  }

  return prisma.assignment.findMany({
    where: { studentId: user.studentProfile.id },
    include: {
      teacher: { include: { user: true } },
      submissions: { orderBy: { submittedAt: "desc" } },
      feedbacks: { orderBy: { createdAt: "desc" } },
      progressUpdates: { orderBy: { createdAt: "desc" }, take: 3 },
    },
    orderBy: { deadline: "asc" },
  });
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: "PENDING" | "IN_PROGRESS" | "SUBMITTED" | "FEEDBACK_GIVEN"
) {
  return prisma.assignment.update({
    where: { id: assignmentId },
    data: { status },
  });
}

export async function getOverdueAssignments() {
  return prisma.assignment.findMany({
    where: {
      deadline: { lt: new Date() },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      student: { include: { user: true } },
      teacher: { include: { user: true } },
    },
  });
}

export async function createProgressUpdate(input: CreateProgressInput) {
  return prisma.progressUpdate.create({
    data: {
      message: input.message,
      assignmentId: input.assignmentId,
      studentId: input.studentId,
    },
  });
}
