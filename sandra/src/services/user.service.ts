import { prisma } from "../config/prisma";
import { generateInviteCode } from "../utils/generateInviteCode";
import { ConflictError, NotFoundError, ValidationError } from "../utils/errors";

const INVITE_CODE_MAX_USES = 5;
const INVITE_CODE_EXPIRY_HOURS = 24;

interface RegisterInput {
  telegramId: string;
  name: string;
}

export async function registerTeacher(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { telegramId: input.telegramId },
  });

  if (existingUser) {
    throw new ConflictError("You are already registered. Use /start to see your options.");
  }

  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_CODE_EXPIRY_HOURS * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      telegramId: input.telegramId,
      name: input.name,
      role: "TEACHER",
      inviteCode,
      inviteCodeExpiresAt: expiresAt,
      inviteCodeUses: 0,
      teacherProfile: { create: {} },
    },
    include: { teacherProfile: true },
  });

  return { user, inviteCode };
}

export async function registerStudent(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { telegramId: input.telegramId },
  });

  if (existingUser) {
    throw new ConflictError("You are already registered. Use /start to see your options.");
  }

  const user = await prisma.user.create({
    data: {
      telegramId: input.telegramId,
      name: input.name,
      role: "STUDENT",
      studentProfile: { create: {} },
    },
    include: { studentProfile: true },
  });

  return { user };
}

export async function linkStudentToTeacher(studentTelegramId: string, code: string) {
  const student = await prisma.user.findUnique({
    where: { telegramId: studentTelegramId },
    include: { studentProfile: true },
  });

  if (!student || !student.studentProfile) {
    throw new NotFoundError("You need to register as a student first. Use /register_student.");
  }

  const teacher = await prisma.user.findFirst({
    where: { inviteCode: code.toUpperCase(), role: "TEACHER" },
    include: { teacherProfile: true },
  });

  if (!teacher || !teacher.teacherProfile) {
    throw new ValidationError("Invalid invite code. Please check and try again.");
  }

  if (teacher.inviteCodeExpiresAt && teacher.inviteCodeExpiresAt < new Date()) {
    throw new ValidationError("This invite code has expired. Ask your teacher for a new one.");
  }

  if (teacher.inviteCodeUses >= INVITE_CODE_MAX_USES) {
    throw new ValidationError("This invite code has been used too many times. Ask your teacher for a new one.");
  }

  // Check if already linked
  const existingLink = await prisma.teacherStudent.findUnique({
    where: {
      teacherId_studentId: {
        teacherId: teacher.teacherProfile.id,
        studentId: student.studentProfile.id,
      },
    },
  });

  if (existingLink) {
    throw new ConflictError(`You are already linked to teacher ${teacher.name}.`);
  }

  await prisma.$transaction([
    prisma.teacherStudent.create({
      data: {
        teacherId: teacher.teacherProfile.id,
        studentId: student.studentProfile.id,
      },
    }),
    prisma.user.update({
      where: { id: teacher.id },
      data: { inviteCodeUses: { increment: 1 } },
    }),
  ]);

  return { teacherName: teacher.name };
}

export async function generateNewInviteCode(teacherTelegramId: string) {
  const user = await prisma.user.findUnique({
    where: { telegramId: teacherTelegramId },
  });

  if (!user || user.role !== "TEACHER") {
    throw new ValidationError("Only teachers can generate invite codes.");
  }

  const newCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + INVITE_CODE_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      inviteCode: newCode,
      inviteCodeExpiresAt: expiresAt,
      inviteCodeUses: 0,
    },
  });

  return { inviteCode: newCode, expiresAt };
}

export async function getUserByTelegramId(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId },
    include: {
      teacherProfile: { include: { teacherStudents: { include: { student: { include: { user: true } } } } } },
      studentProfile: { include: { teacherStudents: { include: { teacher: { include: { user: true } } } } } },
    },
  });
}