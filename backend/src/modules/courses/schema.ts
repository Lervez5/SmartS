import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectID");

export const createCourseSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(100),
    description: z.string().max(1000).optional(),
    subjectId: objectIdSchema,
    teacherId: objectIdSchema,
    category: z.string().optional(),
    modules: z.array(z.object({
      title: z.string(),
      lessons: z.array(z.object({
        title: z.string(),
        type: z.enum(["video", "pdf", "note"])
      })).optional()
    })).optional()
  }),
});

export const updateCourseSchema = z.object({
  body: z.object({
    title: z.string().min(3).max(100).optional(),
    description: z.string().max(1000).optional(),
    teacherId: objectIdSchema.optional(),
    subjectId: objectIdSchema.optional(),
    category: z.string().optional(),
    modules: z.array(z.any()).optional()
  }),
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getCourseSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});
