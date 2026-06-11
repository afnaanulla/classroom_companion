import { prisma } from "../config/prisma";
import { generateStatusSummary } from "../agents/SummarizerAgent";
import { NotFoundError } from "../utils/errors";

export async function getTeacherStatusSummary(teacherTelegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: teacherTelegramId },
    include: { teacherProfile: true },
  });

  if (!user?.teacherProfile) {
    throw new NotFoundError("Teacher not found.");
  }

  const teacherStudents = await prisma.teacherStudent.findMany({
    where: { teacherId: user.teacherProfile.id },
    include: {
      student: {
        include: {
          user: true,
          assignments: {
            include: {
              submissions: { orderBy: { submittedAt: "desc" }, take: 1 },
              progressUpdates: { orderBy: { createdAt: "desc" }, take: 3 },
              feedbacks: { orderBy: { createdAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (teacherStudents.length === 0) {
    return "You don't have any students linked yet. Share your invite code to get started!";
  }

  // Build context string for the summarizer
  const studentsData = teacherStudents
    .map((ts) => {
      const student = ts.student;
      const assignments = student.assignments.map((a) => {
        const latestProgress = a.progressUpdates[0]?.message ?? "No progress updates";
        const latestSubmission = a.submissions[0]
          ? `Submitted on ${a.submissions[0].submittedAt.toLocaleDateString()}`
          : "Not submitted";
        const hasFeedback = a.feedbacks.length > 0 ? "Feedback given" : "No feedback yet";
        return `  - "${a.title}" | Status: ${a.status} | Due: ${a.deadline.toLocaleDateString()} | Progress: ${latestProgress} | ${latestSubmission} | ${hasFeedback}`;
      });

      return `Student: ${student.user.name}\n${assignments.length > 0 ? assignments.join("\n") : "  No assignments yet"}`;
    })
    .join("\n\n");

  return generateStatusSummary(user.name, studentsData);
}

export async function getStudentStatus(studentTelegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: studentTelegramId },
    include: { studentProfile: true },
  });

  if (!user?.studentProfile) {
    throw new NotFoundError("Student not found.");
  }

  const assignments = await prisma.assignment.findMany({
    where: { studentId: user.studentProfile.id },
    include: {
      submissions: { orderBy: { submittedAt: "desc" }, take: 1 },
      feedbacks: { orderBy: { createdAt: "desc" }, take: 1 },
      teacher: { include: { user: true } },
    },
    orderBy: { deadline: "asc" },
  });

  return {
    studentName: user.name,
    assignments: assignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      deadline: a.deadline,
      status: a.status,
      teacherName: a.teacher.user.name,
      latestSubmission: a.submissions[0] ?? null,
      latestFeedback: a.feedbacks[0] ?? null,
    })),
  };
}
