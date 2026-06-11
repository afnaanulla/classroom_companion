import { prisma } from "../config/prisma";
import { classifyIntent } from "./IntentRouterAgent";
import { parseAssignmentInstruction, parseFeedbackInstruction, generateFeedback } from "./TeacherAgent";
import { parseStatusUpdate, parseSubmission } from "./StudentAgent";
import { createAssignment } from "../services/assignment.service";
import { createSubmission } from "../services/submission.service";
import { createProgressUpdate } from "../services/assignment.service";
import { Intent, AgentResponse } from "../types";
import { logger } from "../utils/logger";

export async function processMessage(
  telegramId: string,
  messageText: string
): Promise<AgentResponse> {
  const user = await prisma.user.findUnique({
    where: { telegramId },
    include: { teacherProfile: true, studentProfile: true },
  });

  if (!user) {
    return {
      success: false,
      message: "You are not registered. Use /start to begin.",
    };
  }

  const classification = await classifyIntent(messageText);
  logger.info("Orchestrator", "Intent classified", {
    intent: classification.intent,
    confidence: classification.confidence,
  });

  if (classification.confidence < 0.6 && classification.clarificationMessage) {
    return {
      success: true,
      message: classification.clarificationMessage,
    };
  }

  if (user.role === "TEACHER" && user.teacherProfile) {
    return handleTeacherMessage(
      user.teacherProfile.id,
      user.name,
      messageText,
      classification.intent
    );
  }

  if (user.role === "STUDENT" && user.studentProfile) {
    return handleStudentMessage(
      user.studentProfile.id,
      user.name,
      messageText,
      classification.intent
    );
  }

  return {
    success: false,
    message: "Your account seems incomplete. Please try /start again.",
  };
}

async function handleTeacherMessage(
  teacherId: string,
  teacherName: string,
  message: string,
  intent: Intent
): Promise<AgentResponse> {
  if (intent === Intent.ASSIGNMENT_INSTRUCTION) {
    const parsed = await parseAssignmentInstruction(message);
    if (!parsed) {
      return {
        success: false,
        message: "I couldn't understand the assignment details. Please try again with a title, description, and due date.",
      };
    }

    // Find the target student
    const studentName = parsed.targetStudentName;
    if (!studentName) {
      return {
        success: false,
        message: "Please mention which student this assignment is for. Example: \"Assign Riya to write an essay on photosynthesis, due in 3 days\"",
      };
    }

    // Find student linked to this teacher
    const teacherStudent = await prisma.teacherStudent.findFirst({
      where: {
        teacherId,
        student: {
          user: {
            name: { contains: studentName, mode: "insensitive" },
          },
        },
      },
      include: { student: { include: { user: true } } },
    });

    if (!teacherStudent) {
      return {
        success: false,
        message: `I couldn't find a student named "${studentName}" linked to you. Check /my_students for your student list.`,
      };
    }

    // Parse due date
    const dueDate = parseDueDate(parsed.dueDate);
    if (!dueDate) {
      return {
        success: false,
        message: "I couldn't parse the due date. Please use a format like 'in 3 days', 'tomorrow', or '2026-06-15'.",
      };
    }

    const assignment = await createAssignment({
      teacherId,
      studentId: teacherStudent.studentId,
      title: parsed.title,
      description: parsed.description,
      deadline: dueDate,
    });

    return {
      success: true,
      message: `✅ Assignment created!\n\n📝 *${assignment.title}*\n📅 Due: ${dueDate.toLocaleDateString()}\n👤 Assigned to: ${teacherStudent.student.user.name}\n\nThe student will be notified and reminders will be scheduled.`,
      data: { assignmentId: assignment.id },
    };
  }

  if (intent === Intent.QUERY) {
    const studentQueryMatch = message.match(/(how is|how's|what's the status of|status of)\s+([a-zA-Z]+)/i) || 
                              message.match(/([a-zA-Z]+)'s?\s+(status|progress|doing)/i);
    
    if (studentQueryMatch) {
      const studentName = (studentQueryMatch[2] || studentQueryMatch[1]).trim();
      return handleStudentQuery(teacherId, studentName);
    }

    return {
      success: true,
      message: "Use these commands:\n/my_students — see your students\n/assignments — view all assignments\n/status — get a summary of all students",
    };
  }

  if (intent === Intent.FEEDBACK_REQUEST) {
    const parsedFeedback = await parseFeedbackInstruction(message);
    if (!parsedFeedback) {
      return {
        success: false,
        message: "I couldn't understand which student or assignment you are giving feedback for. Please say something like: 'Give Riya feedback: Great work on the essay!'",
      };
    }

    const studentName = parsedFeedback.targetStudentName;
    if (!studentName) {
      return {
        success: false,
        message: "Please mention which student this feedback is for. Example: 'Give Riya feedback: Great work!'",
      };
    }

    const teacherStudent = await prisma.teacherStudent.findFirst({
      where: {
        teacherId,
        student: {
          user: {
            name: { contains: studentName, mode: "insensitive" },
          },
        },
      },
      include: { student: { include: { user: true } } },
    });

    if (!teacherStudent) {
      return {
        success: false,
        message: `I couldn't find a student named "${studentName}" linked to you.`,
      };
    }

    const assignment = await prisma.assignment.findFirst({
      where: {
        studentId: teacherStudent.studentId,
        teacherId,
        status: "SUBMITTED",
      },
      orderBy: { createdAt: "desc" },
    });

    const targetAssignment = assignment || await prisma.assignment.findFirst({
      where: {
        studentId: teacherStudent.studentId,
        teacherId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!targetAssignment) {
      return {
        success: false,
        message: `I couldn't find any active assignments for ${teacherStudent.student.user.name} to give feedback on.`,
      };
    }

    const feedbackData = await generateFeedback(
      parsedFeedback.feedbackText,
      teacherStudent.student.user.name,
      targetAssignment.title
    );

    const feedbackMsg = feedbackData?.feedbackText || parsedFeedback.feedbackText;

    const { createFeedback } = await import("../services/feedback.service");
    await createFeedback({
      assignmentId: targetAssignment.id,
      teacherId,
      message: feedbackMsg,
    });

    // Notify student
    const { bot } = await import("../telegram/bot");
    await bot.telegram.sendMessage(
      teacherStudent.student.user.telegramId,
      `👩‍🏫 <b>New Feedback Received!</b>\n\n` +
      `📝 <b>Assignment:</b> ${targetAssignment.title}\n` +
      `👩‍🏫 <b>Teacher:</b> ${teacherName}\n` +
      `💬 <b>Feedback:</b> <i>"${feedbackMsg}"</i>\n\n` +
      `Check it in /my_feedback or your student space!`,
      { parse_mode: "HTML" }
    ).catch((err) => console.error("Failed to notify student of feedback:", err));

    return {
      success: true,
      message: `✅ Feedback recorded and sent to ${teacherStudent.student.user.name} for "${targetAssignment.title}":\n\n"${feedbackMsg}"`,
    };
  }

  return {
    success: true,
    message: "As a teacher, you can:\n• Send assignment instructions (mention student name, task, and deadline)\n• Use /assignments to view assignments\n• Use /status for a student summary",
  };
}

export async function handleStudentQuery(teacherId: string, studentName: string): Promise<AgentResponse> {
  const teacherStudent = await prisma.teacherStudent.findFirst({
    where: {
      teacherId,
      student: {
        user: {
          name: { contains: studentName, mode: "insensitive" },
        },
      },
    },
    include: {
      student: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!teacherStudent) {
    return {
      success: false,
      message: `I couldn't find a student named "${studentName}" linked to you.`,
    };
  }

  const student = teacherStudent.student;
  
  const assignments = await prisma.assignment.findMany({
    where: { studentId: student.id },
    include: {
      submissions: { orderBy: { submittedAt: "desc" }, take: 1 },
      progressUpdates: { orderBy: { createdAt: "desc" }, take: 3 },
      feedbacks: { orderBy: { createdAt: "desc" }, take: 1 },
    }
  });

  if (assignments.length === 0) {
    return {
      success: true,
      message: `🎓 *${student.user.name}* has not been assigned any tasks yet.`,
    };
  }

  const assignmentsText = assignments.map((a) => {
    const latestProgress = a.progressUpdates[0]?.message ?? "No progress updates";
    const latestSubmission = a.submissions[0]
      ? `Submitted on ${a.submissions[0].submittedAt.toLocaleDateString()}`
      : "Not submitted";
    const hasFeedback = a.feedbacks.length > 0 ? "Feedback given" : "No feedback yet";
    return `- "${a.title}" | Status: ${a.status} | Due: ${a.deadline.toLocaleDateString()} | Progress: ${latestProgress} | ${latestSubmission} | ${hasFeedback}`;
  }).join("\n");

  const studentData = `Student Name: ${student.user.name}\nAssignments:\n${assignmentsText}`;

  const { generateStatusSummary } = await import("./SummarizerAgent");
  const summary = await generateStatusSummary(student.user.name, studentData);

  return {
    success: true,
    message: summary,
  };
}

async function handleStudentMessage(
  studentId: string,
  studentName: string,
  message: string,
  intent: Intent
): Promise<AgentResponse> {
  if (intent === Intent.STATUS_UPDATE) {
    const parsed = await parseStatusUpdate(message);
    if (!parsed) {
      return {
        success: false,
        message: "I couldn't understand your progress update. Try something like: \"I've finished 3 out of 5 paragraphs for the essay\"",
      };
    }

    // Find the most recent active assignment for this student
    const assignment = await findStudentAssignment(studentId, parsed.assignmentTitle);
    if (!assignment) {
      return {
        success: false,
        message: "I couldn't find an active assignment matching your update. Use /my_assignments to see your assignments.",
      };
    }

    await createProgressUpdate({
      assignmentId: assignment.id,
      studentId,
      message: parsed.progressDescription,
    });

    // Update assignment status to IN_PROGRESS if it's still PENDING
    if (assignment.status === "PENDING") {
      await prisma.assignment.update({
        where: { id: assignment.id },
        data: { status: "IN_PROGRESS" },
      });
    }

    // Proactively notify teacher
    const assignmentDetails = await prisma.assignment.findUnique({
      where: { id: assignment.id },
      include: {
        teacher: { include: { user: true } },
        student: { include: { user: true } },
      },
    });

    if (assignmentDetails && assignmentDetails.teacher.user.telegramId) {
      const { bot } = await import("../telegram/bot");
      const sentimentEmoji = parsed.sentiment === "stuck" ? "😟 Stuck (Needs help!)" : parsed.sentiment === "ahead" ? "🚀 Ahead" : "👍 On Track";
      await bot.telegram.sendMessage(
        assignmentDetails.teacher.user.telegramId,
        `📊 <b>Student Progress Update</b>\n\n` +
        `👤 <b>Student:</b> ${assignmentDetails.student.user.name}\n` +
        `📝 <b>Assignment:</b> ${assignmentDetails.title}\n` +
        `📈 <b>Est. Completion:</b> ~${parsed.estimatedPercentage}%\n` +
        `💬 <b>Update:</b> <i>"${parsed.progressDescription}"</i>\n` +
        `Mood: ${sentimentEmoji}`,
        { parse_mode: "HTML" }
      ).catch((err) => console.error("Failed to notify teacher of student progress:", err));
    }

    const sentimentEmoji = parsed.sentiment === "stuck" ? "😟" : parsed.sentiment === "ahead" ? "🚀" : "👍";

    return {
      success: true,
      message: `${sentimentEmoji} Progress recorded for "${assignment.title}"!\n\n📊 ~${parsed.estimatedPercentage}% complete\n💬 ${parsed.progressDescription}${parsed.sentiment === "stuck" ? "\n\nDon't worry! Let your teacher know if you need help." : ""}`,
    };
  }

  if (intent === Intent.COMPLETION_NOTICE) {
    const parsed = await parseSubmission(message);
    if (!parsed) {
      return {
        success: false,
        message: "I couldn't process your submission. Please try again with the assignment details.",
      };
    }

    const assignment = await findStudentAssignment(studentId, parsed.assignmentTitle);
    if (!assignment) {
      return {
        success: false,
        message: "I couldn't find an active assignment to submit. Use /my_assignments to see your assignments.",
      };
    }

    await createSubmission({
      assignmentId: assignment.id,
      studentId,
      textContent: parsed.textContent,
    });

    // Proactively notify teacher
    const assignmentDetails = await prisma.assignment.findUnique({
      where: { id: assignment.id },
      include: {
        teacher: { include: { user: true } },
        student: { include: { user: true } },
      },
    });

    if (assignmentDetails && assignmentDetails.teacher.user.telegramId) {
      const { bot } = await import("../telegram/bot");
      const escapeHTML = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      
      await bot.telegram.sendMessage(
        assignmentDetails.teacher.user.telegramId,
        `📥 <b>New Submission Received!</b>\n\n` +
        `👤 <b>Student:</b> ${escapeHTML(assignmentDetails.student.user.name)}\n` +
        `📝 <b>Assignment:</b> ${escapeHTML(assignmentDetails.title)}\n` +
        `💬 <b>Content:</b> <i>"${escapeHTML(parsed.textContent)}"</i>\n\n` +
        `Ref: <code>ASM-${assignment.id}</code>\n\n` +
        `Reply directly to this message to send feedback!`,
        { parse_mode: "HTML" }
      ).catch((err) => console.error("Failed to notify teacher of student submission:", err));
    }

    return {
      success: true,
      message: `✅ Submission received for "${assignment.title}"!\n\nYour teacher will review it soon. You'll be notified when feedback is available.`,
    };
  }

  if (intent === Intent.QUERY) {
    return {
      success: true,
      message: "Use these commands:\n/my_assignments — see your assignments\n/my_feedback — view feedback from your teacher",
    };
  }

  return {
    success: true,
    message: "You can:\n• Send progress updates about your assignments\n• Say \"done\" or \"submitting\" to submit your work\n• Use /my_assignments to check your assignments",
  };
}

async function findStudentAssignment(studentId: string, title: string | null) {
  if (title) {
    const byTitle = await prisma.assignment.findFirst({
      where: {
        studentId,
        title: { contains: title, mode: "insensitive" },
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });
    if (byTitle) return byTitle;
  }

  // Fall back to most recent active assignment
  return prisma.assignment.findFirst({
    where: {
      studentId,
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

function parseDueDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime()) && isoDate > new Date()) {
    return isoDate;
  }

  const now = new Date();
  const lower = dateStr.toLowerCase().trim();

  if (lower === "tomorrow") {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  if (lower === "next week") {
    return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  const daysMatch = lower.match(/in\s+(\d+)\s+days?/);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  }

  const hoursMatch = lower.match(/in\s+(\d+)\s+hours?/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10);
    return new Date(now.getTime() + hours * 60 * 60 * 1000);
  }

  return null;
}
