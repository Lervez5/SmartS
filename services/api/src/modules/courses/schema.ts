import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  code: z.string().optional(),
  category: z.string().optional(),
  subjectId: z.string().optional(),
  teacherId: z.string().optional(),
  learningObjectives: z.array(z.string()).optional(),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

export const createClassSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  classCode: z.string().optional(),
  gradeLevel: z.string().optional(),
  subjectId: z.string().optional(),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
});

export const classScheduleSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:MM'),
  room: z.string().optional(),
  recurrence: z.enum(['weekly', 'biweekly', 'daily']).optional(),
  validFrom: z.string(),
  validUntil: z.string().optional(),
});

export type CreateCourseDto = z.infer<typeof createCourseSchema>;
export type UpdateCourseDto = z.infer<typeof updateCourseSchema>;
export type CreateClassDto = z.infer<typeof createClassSchema>;
export type ClassScheduleDto = z.infer<typeof classScheduleSchema>;
