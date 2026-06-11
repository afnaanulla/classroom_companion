import { Router, Request, Response } from "express";
import { getAssignmentsByStudent } from "../services/assignment.service";
import { createSubmission } from "../services/submission.service";
import { getFeedbackHistory } from "../services/feedback.service";
import { getUserByTelegramId } from "../services/user.service";
import { ApiResponse } from "../types";
import { prisma } from "../config/prisma";
import multer from "multer";
import path from "path";
import fs from "fs";
import { bot } from "../telegram/bot";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

export const studentRouter = Router();

function getTelegramId(req: Request): string {
  const id = req.params.telegramId;
  return Array.isArray(id) ? id[0] : id;
}

// GET /api/student/:telegramId/assignments
studentRouter.get("/:telegramId/assignments", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const assignments = await getAssignmentsByStudent(telegramId);
    const mapped = assignments.map((a: any) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      deadline: a.deadline,
      status: a.status,
      teacherName: a.teacher?.user?.name || "",
      teacherTelegramId: a.teacher?.user?.telegramId || "",
      submissions: (a.submissions || []).map((s: any) => ({
        id: s.id,
        textContent: s.textContent,
        filePath: s.filePath,
        reviewed: s.reviewed,
        submittedAt: s.submittedAt,
      })),
      feedbacks: (a.feedbacks || []).map((f: any) => ({
        id: f.id,
        message: f.message,
        createdAt: f.createdAt,
      })),
      recentProgress: (a.progressUpdates || []).map((p: any) => ({
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

// POST /api/student/:telegramId/submit
studentRouter.post("/:telegramId/submit", upload.single("file"), async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const { assignmentId, textContent } = req.body as { assignmentId: string; textContent: string };

    if (!assignmentId || !textContent) {
      const response: ApiResponse<null> = { data: null, error: "assignmentId and textContent are required" };
      res.status(400).json(response);
      return;
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user?.studentProfile) {
      const response: ApiResponse<null> = { data: null, error: "Student not found" };
      res.status(404).json(response);
      return;
    }

    const filePath = req.file ? `uploads/${req.file.filename}` : undefined;

    const submission = await createSubmission({
      assignmentId,
      studentId: user.studentProfile.id,
      textContent,
      filePath,
    });

    // Notify teacher proactively
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        teacher: { include: { user: true } },
        student: { include: { user: true } },
      },
    });

    if (assignment && assignment.teacher.user.telegramId) {
      const escapeHTML = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const fileMsg = filePath ? `\n📎 <b>Attached File:</b> <a href="http://localhost:3000/${filePath}">Download File</a>` : "";

      await bot.telegram.sendMessage(
        assignment.teacher.user.telegramId,
        `📥 <b>New Submission Received!</b> (via Web UI)\n\n` +
        `👤 <b>Student:</b> ${escapeHTML(assignment.student.user.name)}\n` +
        `📝 <b>Assignment:</b> ${escapeHTML(assignment.title)}\n` +
        `💬 <b>Content:</b> <i>"${escapeHTML(textContent)}"</i>` +
        `${fileMsg}\n\n` +
        `Ref: <code>ASM-${assignment.id}</code>\n\n` +
        `Reply directly to this message to send feedback!`,
        { parse_mode: "HTML" }
      ).catch((err) => console.error("Failed to notify teacher of submission:", err));
    }

    const response: ApiResponse<typeof submission> = { data: submission, error: null };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = { data: null, error: String(error) };
    res.status(500).json(response);
  }
});

// GET /api/student/:telegramId/feedback
studentRouter.get("/:telegramId/feedback", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const feedbacks = await getFeedbackHistory(telegramId);
    const mapped = feedbacks.map((f: any) => ({
      id: f.id,
      message: f.message,
      assignmentTitle: f.assignment.title,
      teacherName: f.teacher.user.name,
      createdAt: f.createdAt,
    }));

    const response: ApiResponse<typeof mapped> = { data: mapped, error: null };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = { data: null, error: String(error) };
    res.status(500).json(response);
  }
});

// DELETE /api/student/:telegramId/teachers/:teacherTelegramId
studentRouter.delete("/:telegramId/teachers/:teacherTelegramId", async (req: Request, res: Response) => {
  try {
    const telegramId = getTelegramId(req);
    const teacherTelegramId = req.params.teacherTelegramId as string;

    const studentUser = await getUserByTelegramId(telegramId);
    if (!studentUser?.studentProfile) {
      const response: ApiResponse<null> = { data: null, error: "Student not found" };
      res.status(404).json(response);
      return;
    }

    const teacherUser = await getUserByTelegramId(teacherTelegramId);
    if (!teacherUser?.teacherProfile) {
      const response: ApiResponse<null> = { data: null, error: "Teacher not found" };
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
