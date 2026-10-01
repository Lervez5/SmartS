import { Router } from 'express';
import { prisma } from '../../infrastructure/database';
import { requireRole, requirePermissions } from '../../middleware/rbac';
import { z } from 'zod';

export const router: Router = Router();

const requireClassManage = requirePermissions('cohorts.manage');
const requireClassView = requirePermissions('cohorts.view');

const classInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, email: true } },
  schedules: true,
  _count: { select: { enrollments: true } },
} as const;

const updateClassSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  classCode: z.string().optional(),
  gradeLevel: z.string().optional(),
  subjectId: z.string().optional(),
  courseId: z.string().optional(),
  teacherId: z.string().optional(),
});

router.get('/teacher/my-cohorts', requireClassView, async (req, res, next) => {
  try {
    const classes = await prisma.class.findMany({
      where: { teacherId: req.user!.id },
      include: classInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(classes);
  } catch (e) {
    next(e);
  }
});

router.get('/admin/all-cohorts', requireClassView, async (_req, res, next) => {
  try {
    const classes = await prisma.class.findMany({
      include: classInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(classes);
  } catch (e) {
    next(e);
  }
});

router.get('/', requireClassView, async (req, res, next) => {
  try {
    const classes = await prisma.class.findMany({
      where: req.user!.role === 'TEACHER' ? { teacherId: req.user!.id } : undefined,
      include: classInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(classes);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const cls = await prisma.class.findUnique({
      where: { id: req.params.id },
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
    res.json(cls);
  } catch (e) {
    next(e);
  }
});

router.put('/:id', requireClassManage, async (req, res, next) => {
  try {
    const dto = updateClassSchema.parse(req.body);
    const existing = await prisma.class.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }
    const updated = await prisma.class.update({
      where: { id: req.params.id },
      data: dto,
      include: classInclude,
    });
    res.json(updated);
  } catch (e) {
    next(e);
  }
});
