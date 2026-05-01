import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * QuizAnswer Service
 * Manages individual student answers within a quiz attempt
 */

export async function createAnswer(attemptId: string, questionId: string, response: any) {
  return await prisma.quizAnswer.create({
    data: {
      attemptId,
      questionId,
      response: JSON.parse(JSON.stringify(response)),
    },
  });
}

export async function createManyAnswers(attemptId: string, answers: Array<{ questionId: string; response: any }>) {
  const data = answers.map((a) => ({
    attemptId,
    questionId: a.questionId,
    response: JSON.parse(JSON.stringify(a.response)),
  }));

  return await prisma.quizAnswer.createMany({
    data,
  });
}

export async function getAnswersByAttempt(attemptId: string) {
  return await prisma.quizAnswer.findMany({
    where: { attemptId },
    include: {
      question: {
        select: {
          id: true,
          type: true,
          prompt: true,
          options: true,
          correctAnswer: true,
          difficulty: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function updateAnswerGrade(
  answerId: string,
  { score, feedback, isCorrect }: { score?: number; feedback?: string; isCorrect?: boolean }
) {
  const updateData: any = {};
  if (score !== undefined) updateData.score = score;
  if (feedback !== undefined) updateData.feedback = feedback;
  if (isCorrect !== undefined) updateData.isCorrect = isCorrect;

  return await prisma.quizAnswer.update({
    where: { id: answerId },
    data: updateData,
  });
}

export async function updateAnswerGradeByQuestion(attemptId: string, questionId: string, data: any) {
  return await prisma.quizAnswer.updateMany({
    where: { attemptId, questionId },
    data: {
      ...(data.score !== undefined && { score: data.score }),
      ...(data.feedback !== undefined && { feedback: data.feedback }),
      ...(data.isCorrect !== undefined && { isCorrect: data.isCorrect }),
    },
  });
}

export async function getAnswerById(answerId: string) {
  return await prisma.quizAnswer.findUnique({
    where: { id: answerId },
  });
}
