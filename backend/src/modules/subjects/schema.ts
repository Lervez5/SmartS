import { z } from "zod";

export const createSubjectSchema = z.object({
  name: z.string().min(1).max(100),
});

export const createTopicSchema = z.object({
  subjectId: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const createLessonSchema = z.object({
  subjectId: z.string().uuid(),
  topicId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
});

export const createExerciseSchema = z.object({
  lessonId: z.string().uuid(),
  prompt: z.string().min(1),
  difficulty: z.number().min(0).max(1),
  maxScore: z.number().positive(),
});

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;


