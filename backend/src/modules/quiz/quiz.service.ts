import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Quiz Service
 * Handles quiz CRUD, question linking, and quiz queries
 */

export async function createQuiz(input: {
  title: string;
  description?: string;
  type: string;
  duration: number;
  unitId?: string;
  classId?: string;
  randomize?: boolean;
  showResults?: boolean;
  questions: Array<{
    questionId?: string;
    order: number;
    points: number;
    question?: any; // inline question creation
  }>;
  creatorId: string;
}) {
  // Validate that either unitId or classId is provided (or both? maybe not)
  if (!input.unitId && !input.classId) {
    throw new Error("Quiz must be linked to either a unit or a class");
  }

  return await prisma.$transaction(async (tx) => {
    // Create the quiz
    const quiz = await tx.quiz.create({
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        duration: input.duration,
        unitId: input.unitId || null,
        classId: input.classId || null,
        randomize: input.randomize || false,
        showResults: input.showResults !== false,
      },
    });

    // Link or create questions
    for (const qItem of input.questions) {
      let questionId: string;

      if (qItem.question) {
        // Create new question from inline data
        const newQuestion = await tx.question.create({
          data: {
            type: qItem.question.type,
            prompt: qItem.question.prompt,
            options: qItem.question.options ? JSON.parse(JSON.stringify(qItem.question.options)) : null,
            correctAnswer: qItem.question.correctAnswer ? JSON.parse(JSON.stringify(qItem.question.correctAnswer)) : null,
            explanation: qItem.question.explanation,
            subjectId: qItem.question.subjectId,
            difficulty: qItem.question.difficulty,
          },
        });
        questionId = newQuestion.id;
      } else if (qItem.questionId) {
        // Use existing question
        questionId = qItem.questionId;
      } else {
        throw new Error("Each question must have either questionId or inline question data");
      }

      // Link question to quiz with order and points
      await tx.quizQuestion.create({
        data: {
          quizId: quiz.id,
          questionId,
          order: qItem.order,
          points: qItem.points,
        },
      });
    }

    // Return quiz with questions
    return await tx.quiz.findUnique({
      where: { id: quiz.id },
      include: {
        questions: {
          include: {
            question: true,
          },
          orderBy: { order: "asc" },
        },
        unit: {
          select: {
            id: true,
            title: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });
}

export async function getQuizById(id: string) {
  return await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        include: {
          question: true,
        },
        orderBy: { order: "asc" },
      },
      unit: {
        select: {
          id: true,
          title: true,
        },
      },
      class: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

export async function listQuizzes(filters?: {
  unitId?: string;
  classId?: string;
  type?: string;
  creatorId?: string;
}) {
  const where: any = {};
  if (filters?.unitId) where.unitId = filters.unitId;
  if (filters?.classId) where.classId = filters.classId;
  if (filters?.type) where.type = filters.type;

  return await prisma.quiz.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      questions: {
        include: {
          question: true,
        },
      },
      _count: {
        select: {
          attempts: true,
        },
      },
    },
  });
}

export async function updateQuiz(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    type: string;
    duration: number;
    unitId: string;
    classId: string;
    randomize: boolean;
    showResults: boolean;
    questions: Array<{ questionId: string; order: number; points: number }>;
  }>
) {
  const updateData: any = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.unitId !== undefined) updateData.unitId = data.unitId;
  if (data.classId !== undefined) updateData.classId = data.classId;
  if (data.randomize !== undefined) updateData.randomize = data.randomize;
  if (data.showResults !== undefined) updateData.showResults = data.showResults;

  return await prisma.$transaction(async (tx) => {
    // Update quiz metadata
    const quiz = await tx.quiz.update({
      where: { id },
      data: updateData,
    });

    // If questions array provided, replace question links (full replace)
    if (data.questions) {
      // Delete existing links
      await tx.quizQuestion.deleteMany({
        where: { quizId: id },
      });

      // Create new links
      for (const qItem of data.questions) {
        await tx.quizQuestion.create({
          data: {
            quizId: id,
            questionId: qItem.questionId,
            order: qItem.order,
            points: qItem.points,
          },
        });
      }
    }

    // Return updated quiz
    return await tx.quiz.findUnique({
      where: { id: quiz.id },
      include: {
        questions: {
          include: {
            question: true,
          },
          orderBy: { order: "asc" },
        },
      },
    });
  });
}

export async function deleteQuiz(id: string) {
  // Check for attempts
  const attempts = await prisma.quizAttempt.findMany({
    where: { quizId: id },
    take: 1,
  });

  if (attempts.length > 0) {
    throw new Error("Cannot delete quiz: students have already attempted it");
  }

  // Delete quiz (QuizQuestion links cascade)
  return await prisma.quiz.delete({
    where: { id },
  });
}

export async function getQuizWithQuestionsForStudent(id: string, studentId: string) {
  // For student attempt: fetch quiz with questions but check enrollment if class-linked
  const quiz = await getQuizById(id);

  if (!quiz) {
    return null;
  }

  // Optional: check if student is enrolled in class if quiz is class-linked
  if (quiz.classId) {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        classId: quiz.classId,
        studentId,
      },
    });

    if (!enrollment) {
      throw new Error("You are not enrolled in this quiz's class");
    }
  }

  // If randomize is enabled, shuffle questions
  let questions = [...quiz.questions];
  if (quiz.randomize) {
    // Fisher-Yates shuffle retaining order field is not needed for display
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questions[i], questions[j]] = [questions[j], questions[i]];
    }
  }

  return {
    ...quiz,
    questions,
  };
}

export async function getQuizAnalytics(quizId: string) {
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
    },
  });

  const gradedAttempts = attempts.filter((a) => a.status === "graded" || a.score !== null);
  const scores = gradedAttempts.map((a) => a.score || 0);
  const averageScore = scores.length > 0 ? scores.reduce((s, c) => s + c, 0) / scores.length : 0;

  return {
    totalAttempts: attempts.length,
    gradedCount: gradedAttempts.length,
    averageScore,
    highestScore: Math.max(...scores, 0),
    lowestScore: Math.min(...scores, 0),
    attempts,
  };
}
