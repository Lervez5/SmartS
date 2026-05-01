import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "../../security/rbac";
import {
  createQuiz,
  getQuizById,
  listQuizzes,
  updateQuiz,
  deleteQuiz,
  getQuizWithQuestionsForStudent,
  getQuizAnalytics,
} from "./quiz.service";
import {
  createQuestion,
  getQuestionById,
  listQuestions,
  updateQuestion,
  deleteQuestion,
} from "./questions/questions.service";
import {
  startAttempt,
  submitAttempt,
  getAttemptById,
  getStudentAttempts,
  getQuizAttempts,
} from "./attemps/attemps.service";
import {
  createManyAnswers,
  getAnswersByAttempt,
} from "./answers/answers.service";
import { gradeAttempt, autoGradeAll, gradeSingleAnswer } from "./grading/grading.service";
import { ApiError } from "../../shared/errorHandler";
import { Role } from "../../security/rbac";
import {
  createQuizSchema,
  updateQuizSchema,
  createQuestionSchema,
  updateQuestionSchema,
  submitAttemptSchema,
  gradeAttemptSchema,
} from "./validation";

const prisma = new PrismaClient();

/* ─── Quiz Management ─── */

export async function createQuizController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const parsed = createQuizSchema.parse(req.body);

  const result = await createQuiz({
    ...parsed,
    creatorId: req.user.id,
  });

  res.status(201).json({ quiz: result });
}

export async function getQuizController(req: Request, res: Response) {
  const { id } = req.params;

  const quiz = await getQuizById(id);

  if (!quiz) {
    throw new ApiError(404, "Quiz not found");
  }

  res.json({ quiz });
}

export async function listQuizzesController(req: Request, res: Response) {
  const { unitId, classId, type } = req.query;

  const quizzes = await listQuizzes({
    unitId: unitId as string | undefined,
    classId: classId as string | undefined,
    type: type as string | undefined,
  });

  res.json({ quizzes });
}

export async function updateQuizController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;
  const parsed = updateQuizSchema.parse(req.body);

  const result = await updateQuiz(id, parsed);

  res.json({ quiz: result });
}

export async function deleteQuizController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;

  await deleteQuiz(id);

  res.json({ message: "Quiz deleted successfully" });
}

/* ─── Question Bank ─── */

export async function createQuestionController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const parsed = createQuestionSchema.parse(req.body);

  const result = await createQuestion(parsed);

  res.status(201).json({ question: result });
}

export async function getQuestionController(req: Request, res: Response) {
  const { id } = req.params;

  const question = await getQuestionById(id);

  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  res.json({ question });
}

export async function listQuestionsController(req: Request, res: Response) {
  const { subjectId, type, difficultyMin, difficultyMax } = req.query;

  const questions = await listQuestions({
    subjectId: subjectId as string | undefined,
    type: type as string | undefined,
    difficultyMin: difficultyMin ? Number(difficultyMin) : undefined,
    difficultyMax: difficultyMax ? Number(difficultyMax) : undefined,
  });

  res.json({ questions });
}

export async function updateQuestionController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;
  const parsed = updateQuestionSchema.parse(req.body);

  const result = await updateQuestion(id, parsed);

  res.json({ question: result });
}

export async function deleteQuestionController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { id } = req.params;

  await deleteQuestion(id);

  res.json({ message: "Question deleted successfully" });
}

/* ─── Student Flow ─── */

export async function startQuizController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const { quizId } = req.params;

  const attempt = await startAttempt(quizId, req.user.id);

  res.status(201).json({ attempt });
}

export async function submitQuizController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const { attemptId } = req.params;
  const { answers } = submitAttemptSchema.parse(req.body);

  // Create answers for the attempt
  await createManyAnswers(attemptId, answers as Array<{ questionId: string; response: any }>);

  // Mark attempt as submitted
  const result = await submitAttempt(attemptId, req.user.id);

  res.json({ message: "Quiz submitted successfully", attempt: result });
}

export async function getMyAttemptController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const { attemptId } = req.params;

  const attempt = await getAttemptById(attemptId, req.user.id);

  if (!attempt) {
    throw new ApiError(404, "Attempt not found");
  }

  res.json({ attempt });
}

export async function getMyAttemptsController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const { quizId } = req.query;

  const attempts = await getStudentAttempts(req.user.id, quizId as string | undefined);

  res.json({ attempts });
}

/* ─── Grading ─── */

// Re-define a simple schema for grading a single answer
const gradeAnswerBodySchema = z.object({
  score: z.number().min(0).optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().optional(),
});

export async function autoGradeController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { attemptId } = req.params;

  const result = await autoGradeAll(attemptId);

  res.json({ attempt: result });
}

export async function gradeAnswerController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { answerId } = req.params;
  const { score, feedback, isCorrect } = gradeAnswerBodySchema.parse(req.body);

  const result = await gradeSingleAnswer(answerId, { score, feedback, isCorrect });

  res.json({ attempt: result });
}

/* ─── Analytics (Teacher) ─── */

export async function getQuizAttemptsController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { quizId } = req.params;

  const attempts = await getQuizAttempts(quizId);

  res.json({ attempts });
}

export async function getQuizAnalyticsController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const allowedRoles: Role[] = ["teacher", "school_admin", "super_admin"];
  if (!req.user.role || !allowedRoles.includes(req.user.role as Role)) {
    throw new ApiError(403, "Forbidden: Insufficient permissions");
  }

  const { quizId } = req.params;

  const analytics = await getQuizAnalytics(quizId);

  res.json({ analytics });
}

export async function getAttemptWithAnswersController(req: Request, res: Response) {
  if (!req.user) throw new ApiError(401, "Authentication required");

  const { attemptId } = req.params;

  const attempt = await getAttemptById(attemptId);

  if (!attempt) {
    throw new ApiError(404, "Attempt not found");
  }

  res.json({ attempt });
}
