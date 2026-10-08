/**
 * Teaching allocation routes.
 *
 * Reads need `teaching.view` and writes need `teaching.manage`; the school is
 * the outer scope, so an allocation can never be read or written across schools
 * by supplying another school's id. The academic session is part of the
 * allocation rather than a filter the caller can omit, so a listing always
 * resolves to one session and responsibility cannot leak between them.
 *
 * These routes allocate teachers. They do not provision accounts: a person
 * without one has to go through the existing invitation workflow.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database';
import { requirePermissions } from '../../../middleware/rbac';
import { asyncHandler } from '../../../shared/asyncHandler';
import { ApiError } from '../../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../../settings/scope';
import {
  createAllocationSchema,
  listQuerySchema,
  optionsQuerySchema,
  updateAllocationSchema,
} from './schema';
import {
  createAllocation,
  endAllocation,
  listAllocations,
  streamTeams,
  teacherWorkload,
  updateAllocation,
} from './service';
import { currentSessionId } from './scope';

export const router: Router = Router();

router.use(requireSchoolScope());

/**
 * Options for the allocation form.
 *
 * Everything comes from the caller's own school, so the form can only offer a
 * session, stream, teacher or learning area they are entitled to allocate
 * against. No name is hardcoded and no empty placeholder is invented: a school
 * with no learning areas configured is told so rather than being shown a
 * fabricated list.
 */
router.get(
  '/options',
  requirePermissions('teaching.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = optionsQuerySchema.parse(req.query);

    const sessions = await prisma.academicYear.findMany({
      where: { schoolId },
      select: { id: true, name: true, label: true, status: true, startDate: true },
      orderBy: { startDate: 'desc' },
    });

    const activeSessionId = query.academicYearId ?? (await currentSessionId(schoolId));

    const [classes, subjects, teachers] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          streams: {
            where: { status: 'active' },
            select: { id: true, name: true, code: true },
            orderBy: { code: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.subject.findMany({
        where: { schoolId },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: {
          schoolMemberships: { some: { schoolId } },
          roleMemberships: { some: { role: { name: 'TEACHER' } } },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      sessions,
      activeSessionId,
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevel: c.gradeLevel,
        streams: c.streams,
      })),
      subjects,
      teachers,
    });
  })
);

router.get(
  '/',
  requirePermissions('teaching.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = listQuerySchema.parse(req.query);

    const academicYearId = query.academicYearId ?? (await currentSessionId(schoolId));
    if (!academicYearId) {
      // Rather than guessing, say why there is nothing to show.
      res.json({
        allocations: [],
        total: 0,
        scope: { schoolId },
        note: 'This school has no academic session yet. Create one before allocating teachers.',
      });
      return;
    }

    const result = await listAllocations(schoolId, {
      ...query,
      academicYearId,
      classId: query.classId,
    });

    res.json({ ...result, scope: { schoolId, academicYearId } });
  })
);

/** Stream to team: who covers each stream, and what is unstaffed. */
router.get(
  '/teams',
  requirePermissions('teaching.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = z
      .object({ academicYearId: z.string().optional(), classId: z.string().optional() })
      .parse(req.query);

    const academicYearId = query.academicYearId ?? (await currentSessionId(schoolId));
    if (!academicYearId) {
      res.json({ classes: [], note: 'This school has no academic session yet.' });
      return;
    }

    const classes = await streamTeams(schoolId, academicYearId, query.classId);
    res.json({ classes, scope: { schoolId, academicYearId } });
  })
);

/** Teacher to streams, classes and learning areas. */
router.get(
  '/teachers/:teacherId',
  requirePermissions('teaching.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const result = await teacherWorkload(schoolId, req.params.teacherId);
    res.json(result);
  })
);

router.post(
  '/',
  requirePermissions('teaching.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = createAllocationSchema.parse(req.body);

    const allocation = await createAllocation(
      { schoolId, ...payload },
      req.user!.id ?? null
    );
    res.status(201).json({ allocation });
  })
);

router.patch(
  '/:id',
  requirePermissions('teaching.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = updateAllocationSchema.parse(req.body);

    const allocation = await updateAllocation(schoolId, req.params.id, payload, req.user!.id ?? null);
    res.json({ allocation });
  })
);

/** Ends an allocation, preserving the row as history. */
router.post(
  '/:id/end',
  requirePermissions('teaching.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = z.object({ endedAt: z.coerce.date().optional() }).parse(req.body ?? {});

    const allocation = await endAllocation(
      schoolId,
      req.params.id,
      payload.endedAt,
      req.user!.id ?? null
    );
    res.json({ allocation });
  })
);
