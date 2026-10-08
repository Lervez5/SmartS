import { z } from "zod";

export const createCohortSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  classCode: z.string().optional(),
  gradeLevel: z.string().optional(),
  subjectId: z.string().optional(),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
  schedule: z.string().optional(),
});

export const updateCohortSchema = createCohortSchema.partial();

export const addStudentSchema = z.object({
  studentId: z.string().min(1),
});

export type CreateCohortDto = z.infer<typeof createCohortSchema>;
export type UpdateCohortDto = z.infer<typeof updateCohortSchema>;
