import { Router } from 'express';
import { prisma } from '../../infrastructure/database';
import { requireRole } from '../../middleware/rbac';

export const router: Router = Router();

router.get('/', async (req, res, next) => {
  try {
    // Subjects are school-wide; role only affects what else is joined.
    const subjects = await prisma.subject.findMany({
      include: {
        _count: { select: { classes: true, courses: true, lessons: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(subjects);
  } catch (e) {
    next(e);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id: req.params.id },
      include: {
        topics: true,
        _count: { select: { classes: true, courses: true, lessons: true } },
      },
    });
    if (!subject) {
      res.status(404).json({ error: { message: 'Subject not found' } });
      return;
    }
    res.json(subject);
  } catch (e) {
    next(e);
  }
});
