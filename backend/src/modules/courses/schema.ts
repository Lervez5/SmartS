import { z } from 'zod';

export const createCourseSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(100),
    description: z.string().max(500).optional(),
    teacherId: z.string().uuid(),
    schoolId: z.string().uuid(),
  }),
});

export const updateCourseSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().max(500).optional(),
    teacherId: z.string().uuid().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const getCourseSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});
