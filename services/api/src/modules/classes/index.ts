import { Router } from 'express';
import { prisma } from '../../infrastructure/database';
import { requireRole, requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { z } from 'zod';

export const router: Router = Router();

// A class belongs to one school, and its class teacher is that school's staff.
router.use(requireSchoolScope());

const requireClassManage = requirePermissions('cohorts.manage');
const requireClassView = requirePermissions('cohorts.view');

const classInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, email: true } },
  // The assistant class teacher is a separate role from the class teacher, so
  // both are returned rather than collapsed into one field.
  assistants: {
    select: {
      canManage: true,
      assistant: { select: { id: true, name: true, email: true } },
    },
  },
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
      where: { schoolId: schoolScopeOf(req).schoolId, teacherId: req.user!.id },
      include: classInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(classes);
  } catch (e) {
    next(e);
  }
});

router.get('/admin/all-cohorts', requireClassView, async (req, res, next) => {
  try {
    const classes = await prisma.class.findMany({
      where: { schoolId: schoolScopeOf(req).schoolId },
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
      where: {
        schoolId: schoolScopeOf(req).schoolId,
        // A teacher sees the classes they teach; other roles see the school's.
        ...(req.user!.role === 'TEACHER' ? { teacherId: req.user!.id } : {}),
      },
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
