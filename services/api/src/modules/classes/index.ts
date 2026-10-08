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
} as const;

const createClassSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  classCode: z.string().optional(),
  gradeLevel: z.string().optional(),
  subjectId: z.string().optional(),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
});

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  classCode: z.string().optional(),
  gradeLevel: z.string().optional(),
  subjectId: z.string().optional(),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
});

router.get('/teacher/my-cohorts', requireClassView, asyncHandler(async (req: Request, res: Response) => {
  const classes = await prisma.class.findMany({
    where: { schoolId: schoolScopeOf(req).schoolId, teacherId: req.user!.id },
    include: classInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(classes);
}));

router.get('/admin/all-cohorts', requireClassView, asyncHandler(async (req: Request, res: Response) => {
  const classes = await prisma.class.findMany({
    where: { schoolId: schoolScopeOf(req).schoolId },
    include: classInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(classes);
}));

router.get('/', requireClassView, asyncHandler(async (req: Request, res: Response) => {
  const classes = await prisma.class.findMany({
    where: {
      schoolId: schoolScopeOf(req).schoolId,
      ...(req.user!.role === 'TEACHER' ? { teacherId: req.user!.id } : {}),
    },
    include: classInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(classes);
}));

router.get('/:id', requireClassView, asyncHandler(async (req: Request, res: Response) => {
  const cls = await prisma.class.findFirst({
    where: { id: req.params.id, schoolId: schoolScopeOf(req).schoolId },
    include: {
      ...classInclude,
      enrollments: {
        include: {
          student: { select: { id: true, name: true, email: true } },
        },
      },
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
    },
  });
  if (!cls) {
    res.status(404).json({ error: { message: 'Class not found' } });
    return;
  }
  res.json(cls);
}));

router.post('/', requireClassManage, asyncHandler(async (req: Request, res: Response) => {
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
      throw new ApiError(409, `That school already has a class with the code "${payload.classCode}".`);
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
      schoolId,
    },
    include: classInclude,
  });

  await recordAuditLog(req.user!.id, 'cohorts.created', `Class ${payload.name} created`);

  res.status(201).json(cls);
}));

router.put('/:id', requireClassManage, asyncHandler(async (req: Request, res: Response) => {
  const dto = updateClassSchema.parse(req.body);
  const { schoolId } = schoolScopeOf(req);

  const existing = await prisma.class.findFirst({
    where: { id: req.params.id, schoolId },
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

  const updated = await prisma.class.update({
    where: { id: req.params.id },
    data: dto,
    include: classInclude,
  });

  await recordAuditLog(req.user!.id, 'cohorts.updated', `Class ${updated.name} updated`);

  res.json(updated);
}));
