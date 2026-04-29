import { z } from "zod";

/**
 * Validation schemas for assignment operations
 */

export const createAssignmentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().transform((val) => new Date(val)).optional(),
  classId: z.string().min(1, "Class ID is required"),
  rubric: z.any().optional(),
  maxScore: z.number().positive().optional(),
});

export const updateAssignmentSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  description: z.string().optional(),
  dueDate: z.string().transform((val) => new Date(val)).optional(),
  rubric: z.any().optional(),
  maxScore: z.number().positive().optional(),
});

export const submitAssignmentSchema = z.object({
  content: z.string().min(1, "Content is required"),
});

export const gradeSubmissionSchema = z.object({
  score: z.number().min(0, "Score must be non-negative"),
  feedback: z.string().min(1, "Feedback is required"),
  rubricScores: z.any().optional(),
});

export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
