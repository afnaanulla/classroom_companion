import { Router, Request, Response } from "express";
import { getAssignmentsByTeacher } from "../services/assignment.service";
import { getTeacherStatusSummary } from "../services/status.service";
import { getUserByTelegramId } from "../services/user.service";
import { createFeedback } from "../services/feedback.service";
import { ApiResponse } from "../types";
import { prisma } from "../config/prisma";
import { bot } from "../telegram/bot";

export const teacherRouter = Router();

function getTelegramId(req: Request): string {
  const id = req.params.telegramId;
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/teacher/:telegramId/students
teacherRouter.get("/:telegramId/students", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const user = await getUserByTelegramId(telegramId);
    if (!user?.teacherProfile) {
      const response: ApiResponse<null> = { data: null, error: "Teacher not found" };
      res.status(404).json(response);
      return;
    }

    const students = user.teacherProfile.teacherStudents.map((ts) => ({
      id: ts.student.user.telegramId,
      name: ts.student.user.name,
      linkedAt: ts.createdAt,
    }));

    const response: ApiResponse<typeof students> = { data: students, error: null };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = { data: null, error: String(error) };
    res.status(500).json(response);
  }
});

// GET /api/teacher/:telegramId/assignments
teacherRouter.get("/:telegramId/assignments", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const assignments = await getAssignmentsByTeacher(telegramId);
    const mapped = assignments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      deadline: a.deadline,
      status: a.status,
      studentName: a.student.user.name,
      studentTelegramId: a.student.user.telegramId,
      submissions: a.submissions.map((s) => ({
        id: s.id,
        textContent: s.textContent,
        filePath: s.filePath,
        reviewed: s.reviewed,
        submittedAt: s.submittedAt,
      })),
      feedbacks: a.feedbacks.map((f) => ({
        id: f.id,
        message: f.message,
        createdAt: f.createdAt,
      })),
      recentProgress: a.progressUpdates.map((p) => ({
        message: p.message,
        createdAt: p.createdAt,
      })),
      createdAt: a.createdAt,
    }));

    const response: ApiResponse<typeof mapped> = { data: mapped, error: null };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = { data: null, error: String(error) };
    res.status(500).json(response);
  }
});

// GET /api/teacher/:telegramId/status-summary
teacherRouter.get("/:telegramId/status-summary", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const summary = await getTeacherStatusSummary(telegramId);
    const response: ApiResponse<{ summary: string }> = { data: { summary }, error: null };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = { data: null, error: String(error) };
    res.status(500).json(response);
  }
});

// POST /api/teacher/:telegramId/feedback
teacherRouter.post("/:telegramId/feedback", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const { assignmentId, message } = req.body as { assignmentId: string; message: string };

    if (!assignmentId || !message) {
      const response: ApiResponse<null> = { data: null, error: "assignmentId and message are required" };
      res.status(400).json(response);
      return;
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user?.teacherProfile) {
      const response: ApiResponse<null> = { data: null, error: "Teacher not found" };
      res.status(404).json(response);
      return;
    }

    const feedback = await createFeedback({
      assignmentId,
      teacherId: user.teacherProfile.id,
      message,
    });

    // Notify student proactively
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        student: { include: { user: true } },
        teacher: { include: { user: true } },
      },
    });

    if (assignment && assignment.student.user.telegramId) {
      await bot.telegram.sendMessage(
        assignment.student.user.telegramId,
        `👩‍🏫 <b>New Feedback Received!</b>\n\n` +
        `📝 <b>Assignment:</b> ${assignment.title}\n` +
        `👩‍🏫 <b>Teacher:</b> ${assignment.teacher.user.name}\n` +
        `💬 <b>Feedback:</b> <i>"${message}"</i>\n\n` +
        `Check it in /my_feedback or your student space!`,
        { parse_mode: "HTML" }
      ).catch((err) => console.error("Failed to notify student of feedback:", err));
    }

    const response: ApiResponse<typeof feedback> = { data: feedback, error: null };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = { data: null, error: String(error) };
    res.status(500).json(response);
  }
});

// DELETE /api/teacher/:telegramId/students/:studentTelegramId
teacherRouter.delete("/:telegramId/students/:studentTelegramId", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const studentTelegramId = req.params.studentTelegramId as string;

    const teacherUser = await getUserByTelegramId(telegramId);
    if (!teacherUser?.teacherProfile) {
      const response: ApiResponse<null> = { data: null, error: "Teacher not found" };
      res.status(404).json(response);
      return;
    }

    const studentUser = await getUserByTelegramId(studentTelegramId);
    if (!studentUser?.studentProfile) {
      const response: ApiResponse<null> = { data: null, error: "Student not found" };
      res.status(404).json(response);
      return;
    }

    const { prisma } = await import("../config/prisma");

    const teacherStudent = await prisma.teacherStudent.findFirst({
      where: {
        teacherId: teacherUser.teacherProfile.id,
        studentId: studentUser.studentProfile.id,
      },
    });

    if (!teacherStudent) {
      const response: ApiResponse<null> = { data: null, error: "Link not found" };
      res.status(404).json(response);
      return;
    }

    await prisma.teacherStudent.delete({
      where: { id: teacherStudent.id },
    });

    const response: ApiResponse<{ success: boolean }> = { data: { success: true }, error: null };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = { data: null, error: String(error) };
    res.status(500).json(response);
  }
});
