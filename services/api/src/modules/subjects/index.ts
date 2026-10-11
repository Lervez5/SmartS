import { Router, type Request, type Response } from 'express';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { asyncHandler } from '../../shared/asyncHandler';

/**
 * Subjects - the learning-area catalogue, under its long-standing name.
 *
 * This is a read path over the same `Subject` records the Learning Areas
 * workspace manages. It exists because older callers named them subjects, and
 * it answers from that same record rather than a catalogue of its own, so the
 * two can never disagree.
 *
 * It used to answer with no permission guard and no school filter, which meant
 * any authenticated user could read every school's catalogue. Both are now
 * enforced: `learningAreas.view` to read, and the caller's own school to scope
 * what is returned.
 *
 * Writing is deliberately not here. Creating, editing, retiring and deleting
 * learning areas belongs to the Learning Areas workspace, which validates grade
 * applicability, origin and dependencies. Having a second write path would let a
 * learning area be created that bypasses those checks.
 */

export const router: Router = Router();

router.use(requireSchoolScope());

const requireView = requirePermissions('learningAreas.view');

router.get(
  '/',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const subjects = await prisma.subject.findMany({
      where: { schoolId },
      include: {
        gradeLevels: { orderBy: { gradeLevel: 'asc' } },
        _count: { select: { classes: true, courses: true, lessons: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(subjects);
  })
);

router.get(
  '/:id',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    // Scoped by school, so an id from another school reads as "not found"
    // rather than confirming it exists.
    const subject = await prisma.subject.findFirst({
      where: { id: req.params.id, schoolId },
      include: {
        topics: { orderBy: { name: 'asc' } },
        gradeLevels: { orderBy: { gradeLevel: 'asc' } },
        _count: { select: { classes: true, courses: true, lessons: true } },
      },
    });
    if (!subject) {
      res.status(404).json({ error: { message: 'Subject not found' } });
      return;
    }
    res.json(subject);
  })
);
