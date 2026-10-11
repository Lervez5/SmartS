/**
 * Classes - the authoritative class/grade management module.
 *
 * A class (also called a "grade") is the parent academic structure. Streams
 * subdivide it. This module enforces that hierarchy at the API layer: a stream
 * can only be created against a class that exists in the caller's school and
 * matches the selected academic session.
 *
 * Class lifecycle is managed through `status` (active / inactive / archived).
 * Archiving retains enrolments, attendance and results - it does not delete.
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { z } from 'zod';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';

export const router: Router = Router();

router.use(requireSchoolScope());

const requireClassManage = requirePermissions('cohorts.manage');
const requireClassView = requirePermissions('cohorts.view');

const classInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, email: true } },
  assistants: {
    select: {
      canManage: true,
      assistant: { select: { id: true, name: true, email: true } },
    },
  },
  schedules: true,
  _count: { select: { enrollments: true } },
  academicYear: { select: { id: true, name: true, label: true, status: true } },
  streams: {
    include: {
      _count: { select: { enrollments: true } },
      allocations: {
        where: { status: 'active' },
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { code: 'asc' },
  },
} as const;

const listSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  gradeLevel: z.string().optional(),
  academicYearId: z.string().optional(),
});

const createClassSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  classCode: z.string().optional(),
  gradeLevel: z.string().optional(),
  subjectId: z.string().optional(),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
  academicYearId: z.string().optional(),
});

const updateClassSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().optional().nullable(),
  classCode: z.string().optional().nullable(),
  gradeLevel: z.string().optional().nullable(),
  subjectId: z.string().optional().nullable(),
  courseId: z.string().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  academicYearId: z.string().optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

function mapClass(cls: any) {
  return {
    id: cls.id,
    schoolId: cls.schoolId,
    name: cls.name,
    description: cls.description,
    classCode: cls.classCode,
    gradeLevel: cls.gradeLevel,
    academicYearId: cls.academicYearId,
    academicYear: cls.academicYear,
    status: cls.status,
    subject: cls.subject,
    teacher: cls.teacher,
    assistants: cls.assistants,
    schedules: cls.schedules,
    _count: { enrollments: cls._count?.enrollments ?? 0 },
    streamCount: cls.streams?.length ?? 0,
    activeStreamCount: cls.streams?.filter((s: any) => s.status === 'active').length ?? 0,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt,
    streams: (cls.streams ?? []).map((s: any) => ({
      id: s.id,
      classId: cls.id,
      name: s.name,
      code: s.code,
      capacity: s.capacity,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      learnerCount: s._count?.enrollments ?? 0,
      allocations: (s.allocations ?? []).map((a: any) => ({
        id: a.id,
        responsibility: a.responsibility,
        status: a.status,
        teacher: a.teacher,
        subject: a.subject,
      })),
    })),
  };
}

router.get(
  '/teacher/my-cohorts',
  requireClassView,
  asyncHandler(async (req: Request, res: Response) => {
    const classes = await prisma.class.findMany({
      where: { schoolId: schoolScopeOf(req).schoolId, teacherId: req.user!.id },
      include: classInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ classes: classes.map(mapClass) });
  })
);

router.get(
  '/admin/all-cohorts',
  requireClassView,
  asyncHandler(async (req: Request, res: Response) => {
    const classes = await prisma.class.findMany({
      where: { schoolId: schoolScopeOf(req).schoolId },
      include: classInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json({ classes: classes.map(mapClass) });
  })
);

router.get(
  '/',
  requireClassView,
  asyncHandler(async (req: Request, res: Response) => {
    const { search, status, gradeLevel, academicYearId } = listSchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);

    const where: any = {
      schoolId,
      ...(req.user!.role === 'TEACHER' ? { teacherId: req.user!.id } : {}),
    };

    if (status) {
      where.status = status;
    }
    if (gradeLevel) {
      where.gradeLevel = gradeLevel;
    }
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { classCode: { contains: search, mode: 'insensitive' } },
        { gradeLevel: { contains: search, mode: 'insensitive' } },
      ];
    }

    const classes = await prisma.class.findMany({
      where,
      include: classInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ classes: classes.map(mapClass) });
  })
);

router.get(
  '/:id',
  requireClassView,
  asyncHandler(async (req: Request, res: Response) => {
    const cls = await prisma.class.findFirst({
      where: { id: req.params.id, schoolId: schoolScopeOf(req).schoolId },
      include: {
        ...classInclude,
        enrollments: {
          include: {
            student: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!cls) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }
    res.json({ class: mapClass(cls) });
  })
);

router.post(
  '/',
  requireClassManage,
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createClassSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    if (payload.teacherId) {
      const teacher = await prisma.user.findFirst({
        where: { id: payload.teacherId, schoolMemberships: { some: { schoolId } } },
      });
      if (!teacher) {
        throw new ApiError(400, 'The selected teacher is not a member of this school');
      }
    }

    if (payload.classCode) {
      const clash = await prisma.class.findFirst({
        where: { schoolId, classCode: payload.classCode },
        select: { id: true },
      });
      if (clash) {
        throw new ApiError(
          409,
          `That school already has a class with the code "${payload.classCode}".`
        );
      }
    }

    if (payload.academicYearId) {
      const session = await prisma.academicYear.findFirst({
        where: { id: payload.academicYearId, schoolId },
        select: { id: true, status: true },
      });
      if (!session) {
        throw new ApiError(400, 'The selected academic session does not belong to this school');
      }
      if (session.status !== 'active' && session.status !== 'planned') {
        throw new ApiError(
          400,
          `Cannot assign a class to an academic session that is ${session.status}.`
        );
      }
    }

    const cls = await prisma.class.create({
      data: {
        name: payload.name,
        description: payload.description,
        classCode: payload.classCode,
        gradeLevel: payload.gradeLevel,
        subjectId: payload.subjectId,
        courseId: payload.courseId,
        teacherId: payload.teacherId,
        academicYearId: payload.academicYearId,
        schoolId,
      },
      include: classInclude,
    });

    await recordAuditLog(req.user!.id, 'cohorts.created', `Class ${payload.name} created`);

    res.status(201).json({ class: mapClass(cls) });
  })
);

router.put(
  '/:id',
  requireClassManage,
  asyncHandler(async (req: Request, res: Response) => {
    const dto = updateClassSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, schoolId },
      select: { id: true, name: true, status: true },
    });
    if (!existing) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }

    if (dto.teacherId) {
      const teacher = await prisma.user.findFirst({
        where: { id: dto.teacherId, schoolMemberships: { some: { schoolId } } },
      });
      if (!teacher) {
        throw new ApiError(400, 'The selected teacher is not a member of this school');
      }
    }

    if (dto.academicYearId) {
      const session = await prisma.academicYear.findFirst({
        where: { id: dto.academicYearId, schoolId },
        select: { id: true, status: true },
      });
      if (!session) {
        throw new ApiError(400, 'The selected academic session does not belong to this school');
      }
      if (session.status !== 'active' && session.status !== 'planned') {
        throw new ApiError(
          400,
          `Cannot assign a class to an academic session that is ${session.status}.`
        );
      }
    }

    if (dto.status === 'archived' && existing.status !== 'archived') {
      const streamCount = await prisma.stream.count({
        where: { classId: existing.id, status: { not: 'archived' } },
      });
      if (streamCount > 0) {
        throw new ApiError(
          409,
          `This class has ${streamCount} active or inactive stream(s). Archive its streams first.`
        );
      }
    }

    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data: dto,
      include: classInclude,
    });

    await recordAuditLog(req.user!.id, 'cohorts.updated', `Class ${updated.name} updated`);

    res.json({ class: mapClass(updated) });
  })
);

/**
 * PATCH is for lightweight lifecycle changes (activate / deactivate / archive)
 * that do not touch the class identity or teaching team.
 */
router.patch(
  '/:id',
  requireClassManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = z
      .object({ status: z.enum(['active', 'inactive', 'archived']).optional() })
      .parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, schoolId },
      select: { id: true, name: true, status: true },
    });
    if (!existing) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }

    if (status === 'archived' && existing.status !== 'archived') {
      const streamCount = await prisma.stream.count({
        where: { classId: existing.id, status: { not: 'archived' } },
      });
      if (streamCount > 0) {
        throw new ApiError(
          409,
          `This class has ${streamCount} active or inactive stream(s). Archive its streams first.`
        );
      }
    }

    if (status === 'active' && existing.status === 'archived') {
      throw new ApiError(
        409,
        'Restoring an archived class requires re-creating it; use PUT to re-establish the class.'
      );
    }

    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data: status ? { status } : {},
      include: classInclude,
    });

    await recordAuditLog(
      req.user!.id,
      'cohorts.updated',
      `Class ${existing.name} status changed to ${status ?? existing.status}`
    );

    res.json({ class: mapClass(updated) });
  })
);

/**
 * Archive a class (and its streams) rather than deleting.
 *
 * A class holds streams, which hold enrolments, attendance and results.
 * Archiving retains all of that history in a read-only state.
 */
router.post(
  '/:id/archive',
  requireClassManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, schoolId },
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { enrollments: true, streams: true } },
      },
    });
    if (!existing) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }

    if (existing.status === 'archived') {
      throw new ApiError(409, 'This class is already archived.');
    }

    if (existing._count.streams > 0) {
      const activeStreams = await prisma.stream.count({
        where: { classId: existing.id, status: { not: 'archived' } },
      });
      if (activeStreams > 0) {
        throw new ApiError(
          409,
          `This class has ${activeStreams} active or inactive stream(s). Archive its streams first.`
        );
      }
    }

    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data: { status: 'archived' },
      include: classInclude,
    });

    await prisma.stream.updateMany({
      where: { classId: existing.id, status: { not: 'archived' } },
      data: { status: 'archived' },
    });

    await recordAuditLog(
      req.user!.id,
      'cohorts.archived',
      `Class ${existing.name} archived with ${existing._count.streams} stream(s) and ${existing._count.enrollments} enrolment(s)`
    );

    res.json({
      class: mapClass(updated),
      retained: {
        learners: existing._count.enrollments,
        streams: existing._count.streams,
        note: 'Enrolments, attendance and results are retained; the class and its streams are retired.',
      },
    });
  })
);

router.delete(
  '/:id',
  requireClassManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.class.findFirst({
      where: { id: req.params.id, schoolId },
      select: { id: true, name: true, status: true },
    });
    if (!existing) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }

    const streamCount = await prisma.stream.count({ where: { classId: existing.id } });
    if (streamCount > 0) {
      throw new ApiError(
        409,
        `This class has ${streamCount} stream(s). Archive the class and its streams before deleting.`
      );
    }

    const enrollmentCount = await prisma.enrollment.count({ where: { classId: existing.id } });
    if (enrollmentCount > 0) {
      throw new ApiError(
        409,
        `This class has ${enrollmentCount} enrolment(s). Archive the class before deleting.`
      );
    }

    await prisma.class.delete({ where: { id: req.params.id } });
    await recordAuditLog(req.user!.id, 'cohorts.deleted', `Class ${existing.name} deleted`);

    res.status(204).send();
  })
);
