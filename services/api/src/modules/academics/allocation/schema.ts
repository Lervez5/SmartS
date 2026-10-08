/**
 * Validation for teaching allocations.
 *
 * The rules encoded here are the school's structural ones, and they are enforced
 * server-side because the backend is authoritative for allocation validity: a
 * screen may hide an invalid choice, but nothing about a request is trusted.
 */

import { z } from 'zod';

export const listQuerySchema = z.object({
  academicYearId: z.string().optional(),
  classId: z.string().optional(),
  streamId: z.string().optional(),
  teacherId: z.string().optional(),
  subjectId: z.string().optional(),
  responsibility: z.enum(['main_class_teacher', 'assistant_class_teacher', 'subject_teacher']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().trim().optional(),
  includeEnded: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * A class teacher allocation is a whole-stream responsibility, so it carries no
 * learning area. A subject allocation is meaningless without one, so the subject
 * is required there. Encoding it in the schema means the two cases cannot be sent
 * in a form that would produce a nonsensical record.
 */
const base = {
  teacherId: z.string().min(1),
  responsibility: z.enum(['main_class_teacher', 'assistant_class_teacher', 'subject_teacher']),
  canManage: z.boolean().optional(),
  canEnterResults: z.boolean().optional(),
  effectiveFrom: z.coerce.date().optional(),
};

export const createAllocationSchema = z
  .object({
    ...base,
    academicYearId: z.string().min(1),
    streamId: z.string().min(1),
    subjectId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.responsibility === 'subject_teacher' && !value.subjectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subjectId'],
        message: 'A learning area is required for a learning-area teacher.',
      });
    }
    if (value.responsibility !== 'subject_teacher' && value.subjectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subjectId'],
        message:
          'A class or assistant class teacher is responsible for the whole stream, so no learning area applies.',
      });
    }
  });

/**
 * Only the rights that depend on the responsibility are editable after the fact.
 * Moving an allocation to a different stream, teacher or session is a different
 * allocation, so it is done by ending this one and creating another - which is
 * what keeps the history answerable.
 */
export const updateAllocationSchema = z
  .object({
    canManage: z.boolean().optional(),
    canEnterResults: z.boolean().optional(),
    effectiveFrom: z.coerce.date().optional(),
    effectiveTo: z.coerce.date().nullable().optional(),
    status: z.enum(['active', 'inactive']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });

export const optionsQuerySchema = z.object({
  academicYearId: z.string().optional(),
});
