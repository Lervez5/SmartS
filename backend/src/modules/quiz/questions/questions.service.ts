import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Question Bank Service
 * Manages reusable questions that can be linked to multiple quizzes
 */

export async function createQuestion(input: {
  type: string;
  prompt: string;
  options?: any;
  correctAnswer?: any;
  explanation?: string;
  subjectId?: string;
  difficulty?: number;
}) {
  return await prisma.question.create({
    data: {
      type: input.type,
      prompt: input.prompt,
      options: input.options ? JSON.parse(JSON.stringify(input.options)) : null,
      correctAnswer: input.correctAnswer ? JSON.parse(JSON.stringify(input.correctAnswer)) : null,
      explanation: input.explanation,
      subjectId: input.subjectId,
      difficulty: input.difficulty,
    },
  });
}

export async function getQuestionById(id: string) {
  return await prisma.question.findUnique({
    where: { id },
  });
}

export async function listQuestions(filters?: {
  subjectId?: string;
  type?: string;
  difficultyMin?: number;
  difficultyMax?: number;
}) {
  const where: any = {};
  if (filters?.subjectId) where.subjectId = filters.subjectId;
  if (filters?.type) where.type = filters.type;
  if (filters?.difficultyMin !== undefined || filters?.difficultyMax !== undefined) {
    where.difficulty = {};
    if (filters.difficultyMin !== undefined) (where.difficulty as any).gte = filters.difficultyMin;
    if (filters.difficultyMax !== undefined) (where.difficulty as any).lte = filters.difficultyMax;
  }

  return await prisma.question.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function updateQuestion(id: string, data: Partial<any>) {
  const updateData: any = {};
  if (data.type !== undefined) updateData.type = data.type;
  if (data.prompt !== undefined) updateData.prompt = data.prompt;
  if (data.options !== undefined) updateData.options = JSON.parse(JSON.stringify(data.options));
  if (data.correctAnswer !== undefined) updateData.correctAnswer = JSON.parse(JSON.stringify(data.correctAnswer));
  if (data.explanation !== undefined) updateData.explanation = data.explanation;
  if (data.subjectId !== undefined) updateData.subjectId = data.subjectId;
  if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;

  return await prisma.question.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteQuestion(id: string) {
  // Check if question is linked to any quiz
  const links = await prisma.quizQuestion.findMany({
    where: { questionId: id },
    take: 1,
  });

  if (links.length > 0) {
    throw new Error("Cannot delete question: it is linked to one or more quizzes");
  }

  return await prisma.question.delete({
    where: { id },
  });
}

export async function getQuestionWithBankDetails(id: string) {
  // Get question plus information about which quizzes it appears in
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      quizLinks: {
        include: {
          quiz: {
            select: {
              id: true,
              title: true,
              type: true,
            },
          },
        },
      },
    },
  });

  return question;
}
