import { z } from "zod";

/**
 * Validation schemas for quiz operations
 */

export const createQuizSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  type: z.enum(["quiz", "exam"], { required_error: "Type is required" }),
  duration: z.number().int().positive("Duration must be a positive integer"),
  unitId: z.string().optional(),
  classId: z.string().optional(),
  randomize: z.boolean().optional().default(false),
  showResults: z.boolean().optional().default(true),
  questions: z.array(
    z.object({
      questionId: z.string(),
      order: z.number().int().min(0),
      points: z.number().nonnegative().optional().default(1),
      // If creating new question inline
      question: z
        .object({
          type: z.enum(["mcq", "true_false", "short", "essay"]),
          prompt: z.string().min(1, "Prompt is required"),
          options: z.any().optional(),
          correctAnswer: z.any().optional(),
          explanation: z.string().optional(),
          subjectId: z.string().optional(),
          difficulty: z.number().optional(),
        })
        .optional(),
    })
  ).min(1, "Quiz must have at least one question"),
});

export const updateQuizSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  type: z.enum(["quiz", "exam"]).optional(),
  duration: z.number().int().positive().optional(),
  unitId: z.string().optional(),
  classId: z.string().optional(),
  randomize: z.boolean().optional(),
  showResults: z.boolean().optional(),
});

export const createQuestionSchema = z.object({
  type: z.enum(["mcq", "true_false", "short", "essay"], { required_error: "Question type is required" }),
  prompt: z.string().min(1, "Prompt is required"),
  options: z.any().optional(), // { A: "text", B: "text", ... } or array
  correctAnswer: z.any().optional(), // depends on type: "A", true, string, etc.
  explanation: z.string().optional(),
  subjectId: z.string().optional(),
  difficulty: z.number().min(0).max(10).optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const submitAttemptSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1, "Question ID is required"),
      response: z.any(), // string, number, boolean, array depending on question type
    })
  ).min(1, "At least one answer is required"),
});

export const gradeAnswerSchema = z.object({
  score: z.number().min(0, "Score must be non-negative").optional(),
  feedback: z.string().optional(),
  isCorrect: z.boolean().optional(),
});

export const gradeAttemptSchema = z.object({
  score: z.number().min(0, "Total score is required").optional(),
  feedback: z.string().optional(),
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        score: z.number().min(0).optional(),
        feedback: z.string().optional(),
        isCorrect: z.boolean().optional(),
      })
    )
    .optional(),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
export type GradeAttemptInput = z.infer<typeof gradeAttemptSchema>;
