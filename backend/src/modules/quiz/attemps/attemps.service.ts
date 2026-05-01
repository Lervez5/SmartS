import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * QuizAttempt Service
 * Manages student quiz attempts lifecycle: start, submit, retrieve
 */

export async function startAttempt(quizId: string, studentId: string) {
  // Check if there's an existing in-progress attempt
  const existing = await prisma.quizAttempt.findFirst({
    where: { quizId, studentId, status: "in_progress" },
  });

  if (existing) {
    return existing;
  }

  return await prisma.quizAttempt.create({
    data: {
      quizId,
      studentId,
      status: "in_progress",
    },
  });
}

export async function submitAttempt(attemptId: string, studentId: string) {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: {
        select: {
          id: true,
          duration: true,
        },
      },
    },
  });

  if (!attempt) {
    throw new Error("Attempt not found");
  }

  if (attempt.studentId !== studentId) {
    throw new Error("Unauthorized: cannot submit another student's attempt");
  }

  const submittedAt = new Date();

  // Check if time limit exceeded (optional: auto-submit anyway)
  if (attempt.quiz.duration) {
    const minutesElapsed = (submittedAt.getTime() - attempt.startedAt.getTime()) / (1000 * 60);
    if (minutesElapsed > attempt.quiz.duration) {
      // Could mark as late or still accept - for now we just note
    }
  }

  return await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt,
      status: "submitted",
    },
  });
}

export async function getAttemptById(attemptId: string, studentId?: string) {
  const where: any = { id: attemptId };
  if (studentId) {
    where.studentId = studentId;
  }

  return await prisma.quizAttempt.findFirst({
    where,
    include: {
      quiz: {
        include: {
          questions: {
            include: {
              question: true,
            },
            orderBy: { order: "asc" },
          },
        },
      },
      answers: {
        include: {
          question: true,
        },
      },
    },
  });
}

export async function getStudentAttempts(studentId: string, quizId?: string) {
  const where: any = { studentId };
  if (quizId) {
    where.quizId = quizId;
  }

  return await prisma.quizAttempt.findMany({
    where,
    orderBy: { startedAt: "desc" },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          type: true,
          duration: true,
        },
      },
    },
  });
}

export async function getQuizAttempts(quizId: string, teacherId?: string) {
  // Teacher can view all attempts for their quiz
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              prompt: true,
              type: true,
            },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  return attempts;
}

export async function updateAttemptStatus(attemptId: string, status: "in_progress" | "submitted" | "graded") {
  return await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { status },
  });
}

export async function getInProgressAttempt(quizId: string, studentId: string) {
  return await prisma.quizAttempt.findFirst({
    where: { quizId, studentId, status: "in_progress" },
  });
}
