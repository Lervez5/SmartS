/**
 * Streams - the subdivisions of a class.
 *
 * A stream is not a class: attendance, timetabling and assessment stay anchored
 * to the class, and a stream is how one class is split into teaching groups
 * inside it. Streams therefore carry no teacher of their own. Responsibility for
 * a stream is responsibility for its parent class, resolved through the class
 * teacher and assistant class teacher assignments.
 *
 * Every route is school-scoped, and a stream can only be created against a class
 * belonging to the caller's own school.
 */

import { Router, type Request, type Response } from 'express';
import { StreamStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';

export const router: Router = Router();

router.use(requireSchoolScope());

const listSchema = z.object({
  classId: z.string().optional(),
  status: z.nativeEnum(StreamStatus).optional(),
  search: z.string().optional(),
});

const createSchema = z.object({
  classId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().min(1).max(24),
  capacity: z.coerce.number().int().min(0).max(1000).optional(),
  status: z.nativeEnum(StreamStatus).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  code: z.string().trim().min(1).max(24).optional(),
  capacity: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  status: z.nativeEnum(StreamStatus).optional(),
});

const include = {
  // `satisfies` keeps the status default and the relation shape honest against
  // the generated model rather than letting them drift.
  ...({} as Record<string, never>),
  class: {
    select: {
      id: true,
      name: true,
      gradeLevel: true,
      // The main class teacher and the assistants are reported together, because
      // both are responsible for this class and neither is inferred from a role.
      teacher: { select: { id: true, name: true, email: true } },
      assistants: {
        select: {
          canManage: true,
          assistant: { select: { id: true, name: true, email: true } },
        },
      },
    },
  },
  _count: { select: { enrollments: true } },
} as const;

function present(stream: {
  id: string;
  classId: string;
  name: string;
  code: string;
  capacity: number | null;
  status: StreamStatus;
  createdAt: Date;
  updatedAt: Date;
  class: {
    id: string;
    name: string;
    gradeLevel: string | null;
    teacher: { id: string; name: string | null; email: string } | null;
    assistants: Array<{
      canManage: boolean;
      assistant: { id: string; name: string | null; email: string };
    }>;
  } | null;
  _count: { enrollments: number };
}) {
  return {
    id: stream.id,
    classId: stream.classId,
    name: stream.name,
    code: stream.code,
    capacity: stream.capacity,
    status: stream.status,
    createdAt: stream.createdAt,
    updatedAt: stream.updatedAt,
    learnerCount: stream._count.enrollments,
    parentClass: stream.class
      ? {
          id: stream.class.id,
          name: stream.class.name,
          gradeLevel: stream.class.gradeLevel,
        }
      : null,
    // Reported as the people responsible for the parent class, so the screen
    // shows who is answerable for the stream without inventing a stream owner.
    responsible: stream.class
      ? {
          mainTeacher: stream.class.teacher,
          assistantTeachers: stream.class.assistants.map((row) => ({
            ...row.assistant,
            canManage: row.canManage,
          })),
        }
      : null,
  };
}

router.get(
  '/',
  requirePermissions('academics.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);

    const streams = await prisma.stream.findMany({
      // Scoped through the parent class, which is what carries the school.
      where: {
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
                { class: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        class: { schoolId },
      },
      include,
      orderBy: [{ class: { name: 'asc' } }, { code: 'asc' }],
    });

    res.json({ streams: streams.map(present) });
  })
);

router.post(
  '/',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    // The parent class must belong to the caller's school, so a stream cannot be
    // attached to another school's class by supplying its id.
    const parent = await prisma.class.findFirst({
      where: { id: payload.classId, schoolId },
      select: { id: true },
    });
    if (!parent) {
      throw new ApiError(404, 'Class not found in this school');
    }

    const clash = await prisma.stream.findUnique({
      where: { classId_code: { classId: payload.classId, code: payload.code } },
      select: { id: true },
    });
    if (clash) {
      throw new ApiError(409, `That class already has a stream with the code "${payload.code}".`);
    }

    const stream = await prisma.stream.create({
      data: {
        classId: payload.classId,
        name: payload.name,
        code: payload.code,
        capacity: payload.capacity,
        status: payload.status ?? 'active',
      },
      include,
    });

    res.status(201).json({ stream: present(stream) });
  })
);

router.patch(
  '/:id',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.stream.findFirst({
      where: { id: req.params.id, class: { schoolId } },
      select: { id: true, classId: true, code: true, status: true },
    });
    if (!existing) throw new ApiError(404, 'Stream not found');

    // Only the school’s own courses are offered, so a stream cannot be attached
    // to a course belonging to another school.
    if (payload.code && payload.code !== existing.code) {
      const clash = await prisma.stream.findUnique({
        where: { classId_code: { classId: existing.classId, code: payload.code } },
        select: { id: true },
      });
      if (clash)
        throw new ApiError(409, `That class already has a stream with the code "${payload.code}".`);
    }

    const stream = await prisma.stream.update({
      where: { id: existing.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.code !== undefined ? { code: payload.code } : {}),
        ...(payload.capacity !== undefined ? { capacity: payload.capacity } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
      },
      include,
    });

    res.json({ stream: present(stream) });
  })
);

/**
 * Archive rather than delete.
 *
 * A stream holds learner enrolments, attendance history and assessment results.
 * Deleting it would orphan that history, so a stream is retired through its
 * status and the records remain readable.
 */
router.post(
  '/:id/archive',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.stream.findFirst({
      where: { id: req.params.id, class: { schoolId } },
      select: { id: true, status: true, _count: { select: { enrollments: true } } },
    });
    if (!existing) throw new ApiError(404, 'Stream not found');

    if (existing.status === 'archived') {
      throw new ApiError(409, 'This stream is already archived.');
    }

    const stream = await prisma.stream.update({
      where: { id: existing.id },
      data: { status: 'archived' },
      include,
    });

    res.json({
      stream: present(stream),
      // Surfaced so the caller knows what the archive will affect rather than
      // discovering it later.
      retained: {
        learners: existing._count.enrollments,
        note: 'Enrolments, attendance and results are retained; the stream is retired, not deleted.',
      },
    });
  })
);
