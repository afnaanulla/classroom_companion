import { bot } from "./bot";
import {
    registerTeacher,
    registerStudent,
    linkStudentToTeacher,
    generateNewInviteCode,
    getUserByTelegramId,
} from "../services/user.service";
import { getAssignmentsByTeacher, getAssignmentsByStudent } from "../services/assignment.service";
import { getFeedbackHistory } from "../services/feedback.service";
import { getTeacherStatusSummary } from "../services/status.service";
import { processMessage, handleStudentQuery } from "../agents/Orchestrator";
import { logger } from "../utils/logger";

function escapeHTML(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ── /start ──
bot.start(async (context) => {
    const telegramId = String(context.from.id);
    const user = await getUserByTelegramId(telegramId);

    if (user) {
        const roleLabel = user.role === "TEACHER" ? "👩‍🏫 Teacher" : "🎓 Student";
        await context.reply(
            `Welcome back, <b>${escapeHTML(user.name)}</b>! (${roleLabel})\n\n` +
            `💻 Web Login ID: <code>${telegramId}</code> (tap to copy)\n\n` +
            (user.role === "TEACHER"
                ? "Commands:\n/my_students — View your students\n/assignments — View assignments\n/status — Get student summary\n/new_code — Generate new invite code\n\nOr just type an assignment instruction!"
                : "Commands:\n/my_assignments — View your assignments\n/my_feedback — View feedback\n\nOr send a progress update!"),
            { parse_mode: "HTML" }
        );
        return;
    }

    await context.reply(
        "👋 Welcome to Classroom Companion!\n\n" +
        "Choose your role:\n" +
        "/register_teacher — I'm a teacher\n" +
        "/register_student — I'm a student"
    );
});

// ── /register_teacher ──
bot.command("register_teacher", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const args = context.message.text.split(" ").slice(1).join(" ").trim();
        const name = args || context.from.first_name || "Teacher";
        const result = await registerTeacher({ telegramId, name });

        await context.reply(
            `✅ Teacher registration complete!\n\n` +
            `👤 Name: <b>${escapeHTML(name)}</b>\n` +
            `🔑 Invite Code: <code>${result.inviteCode}</code>\n` +
            `💻 Web Login ID: <code>${telegramId}</code> (tap to copy)\n\n` +
            `Share this code with your students so they can link to you.\n` +
            `The code expires in 24 hours and can be used up to 5 times.\n\n` +
            `Use <code>/new_code</code> to generate a fresh code anytime.`,
            { parse_mode: "HTML" }
        );
    } catch (error) {
        await context.reply(error instanceof Error ? error.message : "Registration failed. Please try again.");
    }
});

// ── /register_student ──
bot.command("register_student", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const args = context.message.text.split(" ").slice(1).join(" ").trim();
        const name = args || context.from.first_name || "Student";
        await registerStudent({ telegramId, name });

        await context.reply(
            `✅ Student registration complete!\n\n` +
            `👤 Name: <b>${escapeHTML(name)}</b>\n` +
            `💻 Web Login ID: <code>${telegramId}</code> (tap to copy)\n\n` +
            `Now link to your teacher using their invite code:\n` +
            `/link_teacher YOUR_CODE`,
            { parse_mode: "HTML" }
        );
    } catch (error) {
        await context.reply(error instanceof Error ? error.message : "Registration failed. Please try again.");
    }
});

// ── /link_teacher <code> ──
bot.command("link_teacher", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const code = context.message.text.split(" ")[1];

        if (!code) {
            await context.reply("Please provide an invite code.\nExample: /link_teacher ABC123");
            return;
        }

        const result = await linkStudentToTeacher(telegramId, code);
        await context.reply(
            `✅ Successfully linked to teacher: ${result.teacherName}!\n\n` +
            `You'll now receive assignments and reminders from your teacher.\n` +
            `Use /my_assignments to see your assignments.`
        );

        // Notify the teacher
        const student = await getUserByTelegramId(telegramId);
        if (student) {
            const teacher = await findTeacherByInviteCode(code);
            if (teacher) {
                await bot.telegram.sendMessage(
                    teacher.telegramId,
                    `🎓 New student linked!\n\n👤 ${student.name} has joined your class.`
                );
            }
        }
    } catch (error) {
        await context.reply(error instanceof Error ? error.message : "Linking failed. Please check the code and try again.");
    }
});

// ── /new_code ──
bot.command("new_code", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const result = await generateNewInviteCode(telegramId);

        await context.reply(
            `🔑 New invite code generated!\n\n` +
            `Code: <code>${result.inviteCode}</code>\n` +
            `Expires: ${result.expiresAt.toLocaleString()}\n\n` +
            `Share this with your students.`,
            { parse_mode: "HTML" }
        );
    } catch (error) {
        await context.reply(error instanceof Error ? error.message : "Failed to generate new code.");
    }
});

// ── /my_students ──
bot.command("my_students", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const user = await getUserByTelegramId(telegramId);

        if (!user?.teacherProfile) {
            await context.reply("This command is only for teachers.");
            return;
        }

        const students = user.teacherProfile.teacherStudents;
        if (students.length === 0) {
            await context.reply("No students linked yet. Share your invite code!");
            return;
        }

        const studentList = students
            .map((ts, i) => `${i + 1}. ${ts.student.user.name}`)
            .join("\n");

        await context.reply(`👥 Your Students:\n\n${studentList}`);
    } catch (error) {
        await context.reply("Failed to fetch students. Please try again.");
    }
});

// ── /assignments (teacher) ──
bot.command("assignments", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const assignments = await getAssignmentsByTeacher(telegramId);

        if (assignments.length === 0) {
            await context.reply("No assignments yet. Send an assignment instruction to create one!");
            return;
        }

        const statusEmoji = (s: string) =>
            s === "PENDING" ? "⏳" : s === "IN_PROGRESS" ? "🔄" : s === "SUBMITTED" ? "📬" : "✅";

        const list = assignments
            .map(
                (a: any) =>
                    `${statusEmoji(a.status)} <b>${escapeHTML(a.title)}</b>\n   👤 ${escapeHTML(a.student.user.name)} | 📅 ${a.deadline.toLocaleDateString()} | ${a.status}`
            )
            .join("\n\n");

        await context.reply(`📝 Your Assignments:\n\n${list}`, { parse_mode: "HTML" });
    } catch (error) {
        await context.reply("Failed to fetch assignments. Please try again.");
    }
});

// ── /my_assignments (student) ──
bot.command("my_assignments", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const assignments = await getAssignmentsByStudent(telegramId);

        if (assignments.length === 0) {
            await context.reply("No assignments yet. Your teacher will assign you work soon!");
            return;
        }

        const statusEmoji = (s: string) =>
            s === "PENDING" ? "⏳" : s === "IN_PROGRESS" ? "🔄" : s === "SUBMITTED" ? "📬" : "✅";

        const list = assignments
            .map(
                (a) =>
                    `${statusEmoji(a.status)} <b>${escapeHTML(a.title)}</b>\n   📅 Due: ${a.deadline.toLocaleDateString()} | ${a.status}\n   📝 ${escapeHTML(a.description)}`
            )
            .join("\n\n");

        await context.reply(`📚 Your Assignments:\n\n${list}`, { parse_mode: "HTML" });
    } catch (error) {
        await context.reply("Failed to fetch assignments. Please try again.");
    }
});

// ── /my_feedback (student) ──
bot.command("my_feedback", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const feedbacks = await getFeedbackHistory(telegramId);

        if (feedbacks.length === 0) {
            await context.reply("No feedback received yet.");
            return;
        }

        const list = feedbacks
            .map(
                (f: any) =>
                    `📝 <b>${escapeHTML(f.assignment.title)}</b>\n👩‍🏫 ${escapeHTML(f.teacher.user.name)}\n💬 ${escapeHTML(f.message)}\n📅 ${f.createdAt.toLocaleDateString()}`
            )
            .join("\n\n---\n\n");

        await context.reply(`💬 Your Feedback:\n\n${list}`, { parse_mode: "HTML" });
    } catch (error) {
        await context.reply("Failed to fetch feedback. Please try again.");
    }
});

// ── /status (teacher) ──
bot.command("status", async (context) => {
    try {
        const telegramId = String(context.from.id);
        await context.reply("🔄 Generating status summary...");
        const summary = await getTeacherStatusSummary(telegramId);
        await context.reply(`📊 Status Summary:\n\n${summary}`);
    } catch (error) {
        await context.reply(error instanceof Error ? error.message : "Failed to generate status.");
    }
});

// ── /message (chat between teacher and student) ──
bot.command("message", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const user = await getUserByTelegramId(telegramId);

        if (!user) {
            await context.reply("You are not registered. Use /start to begin.");
            return;
        }

        const text = context.message.text.split(" ").slice(1).join(" ").trim();
        if (!text) {
            if (user.role === "TEACHER") {
                await context.reply("Please specify student name and message.\nExample: /message Riya Hello, did you start the essay?");
            } else {
                await context.reply("Please specify a message.\nExample: /message Hello teacher, I have a question.");
            }
            return;
        }

        const { prisma } = await import("../config/prisma");

        if (user.role === "TEACHER") {
            const firstSpace = text.indexOf(" ");
            if (firstSpace === -1) {
                await context.reply("Please specify both student name and message.\nExample: /message Riya Hello");
                return;
            }
            const studentName = text.substring(0, firstSpace).trim();
            const messageContent = text.substring(firstSpace + 1).trim();

            const teacherProfile = user.teacherProfile;
            if (!teacherProfile) {
                await context.reply("Teacher profile not found.");
                return;
            }

            const teacherStudent = await prisma.teacherStudent.findFirst({
                where: {
                    teacherId: teacherProfile.id,
                    student: {
                        user: {
                            name: { contains: studentName, mode: "insensitive" },
                        },
                    },
                },
                include: { student: { include: { user: true } } },
            });

            if (!teacherStudent) {
                await context.reply(`Could not find a student named "${studentName}" linked to you. Check /my_students.`);
                return;
            }

            await bot.telegram.sendMessage(
                teacherStudent.student.user.telegramId,
                `💬 <b>Message from Teacher ${escapeHTML(user.name)}:</b>\n\n${escapeHTML(messageContent)}`,
                { parse_mode: "HTML" }
            );
            await context.reply(`✅ Message sent to student ${teacherStudent.student.user.name}.`);
        } else {
            const studentProfile = user.studentProfile;
            if (!studentProfile) {
                await context.reply("Student profile not found.");
                return;
            }

            const teacherStudents = studentProfile.teacherStudents;
            if (teacherStudents.length === 0) {
                await context.reply("You are not linked to any teacher yet. Use /link_teacher <invite_code> first.");
                return;
            }

            for (const ts of teacherStudents) {
                await bot.telegram.sendMessage(
                    ts.teacher.user.telegramId,
                    `💬 <b>Message from Student ${escapeHTML(user.name)}:</b>\n\n${escapeHTML(text)}`,
                    { parse_mode: "HTML" }
                );
            }
            await context.reply(`✅ Message sent to your teacher.`);
        }
    } catch (error) {
        logger.error("TelegramHandler", "Failed to send message", { error: String(error) });
        await context.reply("Failed to send message. Please try again.");
    }
});

// ── Natural language message handler (catch-all) ──
bot.on("text", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const messageText = context.message.text;

        // Skip if it looks like a command
        if (messageText.startsWith("/")) return;

        // ── Check if this is a reply to a forwarded chat message ──
        const replyTo = context.message.reply_to_message as any;
        if (replyTo && replyTo.text) {
            const originalText = replyTo.text as string;
            const user = await getUserByTelegramId(telegramId);

            if (user) {
                const { prisma } = await import("../config/prisma");

                if (user.role === "TEACHER" && user.teacherProfile) {
                    // Teacher replying to student direct message
                    const match = originalText.match(/Message from Student (.*?):/);
                    if (match) {
                        const studentName = match[1].trim();
                        const teacherStudent = await prisma.teacherStudent.findFirst({
                            where: {
                                teacherId: user.teacherProfile.id,
                                student: {
                                    user: {
                                        name: { contains: studentName, mode: "insensitive" },
                                    },
                                },
                            },
                            include: { student: { include: { user: true } } },
                        });

                        if (teacherStudent) {
                            await bot.telegram.sendMessage(
                                teacherStudent.student.user.telegramId,
                                `💬 <b>Message from Teacher ${escapeHTML(user.name)}:</b>\n\n${escapeHTML(messageText)}`,
                                { parse_mode: "HTML" }
                            );
                            await context.reply(`✅ Message sent to student ${teacherStudent.student.user.name}.`);
                            return;
                        }
                    }

                    // Teacher replying to submission alert to give feedback
                    const isSubmissionMsg = originalText.includes("New Submission Received!");
                    if (isSubmissionMsg) {
                        const refMatch = originalText.match(/Ref:\s*ASM-([a-zA-Z0-9_-]+)/) || originalText.match(/ASM-([a-zA-Z0-9_-]+)/);
                        if (refMatch) {
                            const assignmentId = refMatch[1].trim();
                            const { createFeedback } = await import("../services/feedback.service");
                            await createFeedback({
                                assignmentId,
                                teacherId: user.teacherProfile.id,
                                message: messageText,
                            });

                            const assignment = await prisma.assignment.findUnique({
                                where: { id: assignmentId },
                                include: { student: { include: { user: true } } },
                            });

                            if (assignment) {
                                await bot.telegram.sendMessage(
                                    assignment.student.user.telegramId,
                                    `👩‍🏫 <b>New Feedback Received!</b>\n\n` +
                                    `📝 <b>Assignment:</b> ${assignment.title}\n` +
                                    `👩‍🏫 <b>Teacher:</b> ${user.name}\n` +
                                    `💬 <b>Feedback:</b> <i>"${messageText}"</i>\n\n` +
                                    `Check it in /my_feedback or your student space!`,
                                    { parse_mode: "HTML" }
                                ).catch((err) => console.error("Failed to notify student of feedback:", err));

                                await context.reply(`✅ Feedback recorded and sent to student ${assignment.student.user.name}.`);
                                return;
                            }
                        }
                    }
                } else if (user.role === "STUDENT" && user.studentProfile) {
                    // Student replying to teacher
                    const isTeacherMsg = originalText.includes("Message from Teacher");

                    if (isTeacherMsg) {
                        const teacherStudents = user.studentProfile.teacherStudents;
                        if (teacherStudents.length > 0) {
                            for (const ts of teacherStudents) {
                                await bot.telegram.sendMessage(
                                    ts.teacher.user.telegramId,
                                    `💬 <b>Message from Student ${escapeHTML(user.name)}:</b>\n\n${escapeHTML(messageText)}`,
                                    { parse_mode: "HTML" }
                                );
                            }
                            await context.reply(`✅ Message sent to your teacher.`);
                            return;
                        }
                    }
                }
            }
        }

        const response = await processMessage(telegramId, messageText);
        try {
            await context.reply(response.message, { parse_mode: "Markdown" });
        } catch {
            await context.reply(response.message);
        }

        // If assignment was created, notify the student
        if (response.data?.assignmentId) {
            await notifyStudentOfNewAssignment(response.data.assignmentId as string);
        }
    } catch (error) {
        logger.error("TelegramHandler", "Message processing failed", { error: String(error) });
        await context.reply("Sorry, I encountered an error processing your message. Please try again.");
    }
});

// ── /ask StudentName (Teacher query about student performance) ──
bot.command("ask", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const user = await getUserByTelegramId(telegramId);

        if (!user?.teacherProfile) {
            await context.reply("This command is only for teachers.");
            return;
        }

        const studentName = context.message.text.split(" ").slice(1).join(" ").trim();
        if (!studentName) {
            await context.reply("Please specify student name.\nExample: /ask Riya");
            return;
        }

        await context.reply(`🔄 Querying performance summary for ${studentName}...`);
        const response = await handleStudentQuery(user.teacherProfile.id, studentName);
        await context.reply(response.message);
    } catch (error) {
        await context.reply("Failed to fetch student status summary. Make sure the student is linked to you.");
    }
});

// ── Voice note handler (transcribe & feed to agents) ──
bot.on("voice", async (context) => {
    try {
        const telegramId = String(context.from.id);
        const voice = context.message.voice;
        const fileId = voice.file_id;

        await context.reply("🎙️ Processing voice note...");

        const fileLink = await context.telegram.getFileLink(fileId);
        const fileUrl = fileLink.href;

        const axios = await import("axios");
        const fs = await import("fs");
        const path = await import("path");

        const tempDir = path.join(process.cwd(), "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempFilePath = path.join(tempDir, `${fileId}.ogg`);

        const responseStream = await axios.default({
            method: "GET",
            url: fileUrl,
            responseType: "stream",
        });

        const writer = fs.createWriteStream(tempFilePath);
        responseStream.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const { groqClient } = await import("../config/groq");
        const transcription = await groqClient.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-large-v3",
        });

        try {
            fs.unlinkSync(tempFilePath);
        } catch {}

        const text = transcription.text;
        if (!text.trim()) {
            await context.reply("I couldn't hear any words in your voice note. Please try again.");
            return;
        }

        await context.reply(`🎙️ <b>Transcribed:</b> <i>"${escapeHTML(text)}"</i>`, { parse_mode: "HTML" });

        const agentResponse = await processMessage(telegramId, text);
        try {
            await context.reply(agentResponse.message, { parse_mode: "Markdown" });
        } catch {
            await context.reply(agentResponse.message);
        }

        if (agentResponse.data?.assignmentId) {
            await notifyStudentOfNewAssignment(agentResponse.data.assignmentId as string);
        }
    } catch (error) {
        logger.error("TelegramHandler", "Voice note processing failed", { error: String(error) });
        await context.reply("Sorry, I failed to process your voice note. Make sure Groq API is fully configured.");
    }
});

// ── Photo / Document submission handlers ──
async function handleTelegramFileSubmission(context: any, fileId: string, originalName: string, caption?: string) {
    try {
        const telegramId = String(context.from.id);
        const user = await getUserByTelegramId(telegramId);

        if (!user || user.role !== "STUDENT" || !user.studentProfile) {
            await context.reply("Only registered students can submit files.");
            return;
        }

        const studentId = user.studentProfile.id;
        const { prisma } = await import("../config/prisma");

        let assignmentId: string | null = null;
        const replyTo = context.message.reply_to_message as any;
        if (replyTo && replyTo.text) {
            const originalText = replyTo.text as string;
            const match = originalText.match(/Ref:\s*ASM-([a-zA-Z0-9_-]+)/) || originalText.match(/ASM-([a-zA-Z0-9_-]+)/);
            if (match) {
                assignmentId = match[1].trim();
            }
        }

        if (!assignmentId) {
            const activeAssignment = await prisma.assignment.findFirst({
                where: {
                    studentId,
                    status: { in: ["PENDING", "IN_PROGRESS"] },
                },
                orderBy: { createdAt: "desc" },
            });
            if (activeAssignment) {
                assignmentId = activeAssignment.id;
            }
        }

        if (!assignmentId) {
            await context.reply("I couldn't find an active assignment to associate this file with. Use /my_assignments to see your active tasks.");
            return;
        }

        const assignment = await prisma.assignment.findUnique({
            where: { id: assignmentId },
            include: { teacher: { include: { user: true } }, student: { include: { user: true } } },
        });

        if (!assignment) {
            await context.reply("Assignment not found.");
            return;
        }

        await context.reply("📎 Uploading file...");

        const fileLink = await context.telegram.getFileLink(fileId);
        const fileUrl = fileLink.href;

        const axios = await import("axios");
        const fs = await import("fs");
        const path = await import("path");

        const uploadsDir = path.join(process.cwd(), "uploads");
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(originalName) || ".jpg";
        const fileName = `${uniqueSuffix}${ext}`;
        const savePath = path.join(uploadsDir, fileName);

        const responseStream = await axios.default({
            method: "GET",
            url: fileUrl,
            responseType: "stream",
        });

        const writer = fs.createWriteStream(savePath);
        responseStream.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        const filePath = `uploads/${fileName}`;
        const textContent = caption || `Uploaded file via Telegram: ${originalName}`;

        const { createSubmission } = await import("../services/submission.service");
        await createSubmission({
            assignmentId: assignment.id,
            studentId,
            textContent,
            filePath,
        });

        const fileMsg = `\n📎 <b>Attached File:</b> <a href="http://localhost:3000/${filePath}">Download File</a>`;

        await bot.telegram.sendMessage(
            assignment.teacher.user.telegramId,
            `📥 <b>New Submission Received!</b> (via Telegram File)\n\n` +
            `👤 <b>Student:</b> ${escapeHTML(assignment.student.user.name)}\n` +
            `📝 <b>Assignment:</b> ${escapeHTML(assignment.title)}\n` +
            `💬 <b>Caption:</b> <i>"${escapeHTML(textContent)}"</i>` +
            `${fileMsg}\n\n` +
            `Ref: <code>ASM-${assignment.id}</code>\n\n` +
            `Reply directly to this message to send feedback!`,
            { parse_mode: "HTML" }
        ).catch((err) => console.error("Failed to notify teacher of file submission:", err));

        await context.reply(`✅ Submission received for "${assignment.title}" with attachment!\n\nYour teacher has been notified.`);
    } catch (error) {
        logger.error("TelegramHandler", "File submission failed", { error: String(error) });
        await context.reply("Sorry, I failed to process your file submission. Please try again.");
    }
}

bot.on("photo", async (context) => {
    const photo = context.message.photo;
    const highestPhoto = photo[photo.length - 1];
    const fileId = highestPhoto.file_id;
    const caption = context.message.caption;
    await handleTelegramFileSubmission(context, fileId, "photo.jpg", caption);
});

bot.on("document", async (context) => {
    const doc = context.message.document;
    const fileId = doc.file_id;
    const fileName = doc.file_name || "document";
    const caption = context.message.caption;
    await handleTelegramFileSubmission(context, fileId, fileName, caption);
});

// ── Helper functions ──

async function findTeacherByInviteCode(code: string) {
    const { prisma } = await import("../config/prisma");
    return prisma.user.findFirst({
        where: { inviteCode: code.toUpperCase(), role: "TEACHER" },
    });
}

async function notifyStudentOfNewAssignment(assignmentId: string) {
    const { prisma } = await import("../config/prisma");
    const assignment = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        include: {
            student: { include: { user: true } },
            teacher: { include: { user: true } },
        },
    });

    if (!assignment) return;

    try {
        await bot.telegram.sendMessage(
            assignment.student.user.telegramId,
            `📚 <b>New Assignment!</b>\n\n` +
            `📝 <b>${escapeHTML(assignment.title)}</b>\n` +
            `${escapeHTML(assignment.description)}\n\n` +
            `📅 Due: ${assignment.deadline.toLocaleDateString()}\n` +
            `👩‍🏫 From: ${escapeHTML(assignment.teacher.user.name)}\n\n` +
            `Send me progress updates anytime!`,
            { parse_mode: "HTML" }
        );
    } catch {
        logger.warn("TelegramHandler", "Failed to notify student of new assignment", { assignmentId });
    }
}