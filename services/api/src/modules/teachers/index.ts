/**
 * Teachers module.
 *
 * The teacher-facing surface of the platform. Routes here answer "what classes
 * and learning areas does this teacher cover" and other read-only questions the
 * teacher portal raises about the person's own teaching load.
 *
 * Responsibility lives in the allocation service under
 * `academics/allocation`. What this module adds is the aggregation a teacher's
 * own-class screen needs: grouping allocations by class, surfacing the
 * streams and learning areas in one shape, and the metrics the dashboard
 * summarises.
 *
 * Permissions: `cohorts.view` — the same grant the classes module uses for
 * teacher-scoped cohort listing. A teacher viewing their own assignments
 * reaches this endpoint through the classes permission they already hold.
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { currentSessionId } from '../academics/allocation/scope';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

export const router: Router = Router();

router.use(requireSchoolScope());

const requireView = requirePermissions('cohorts.view');

router.get(
  '/my-classes',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Sign in to see your classes.');
    }

    const academicYearId = await currentSessionId(schoolId);

    // Fetch every active allocation this teacher holds, across all
    // responsibilities and sessions. The frontend resolves the "current"
    // session itself, so we return it in the scope.
    const allocations = await prisma.streamAllocation.findMany({
      where: {
        schoolId,
        teacherId,
        status: 'active',
        ...(academicYearId ? { academicYearId } : {}),
      },
      include: {
        stream: {
          select: {
            id: true,
            name: true,
            code: true,
            class: { select: { id: true, name: true, gradeLevel: true } },
            _count: { select: { enrollments: true } },
          },
        },
        class: {
          select: { id: true, name: true, gradeLevel: true },
        },
        subject: { select: { id: true, name: true, code: true } },
        academicYear: { select: { id: true, name: true, label: true, status: true } },
      },
      orderBy: [
        { stream: { class: { name: 'asc' } } },
        { responsibility: 'asc' },
        { effectiveFrom: 'asc' },
      ],
    });

    if (academicYearId == null) {
      res.json({
        classes: [],
        total: 0,
        metrics: emptyMetrics(),
        scope: { schoolId },
        note: 'This school has no academic session yet.',
      });
      return;
    }

    // Group allocations by class, building the response shape the teacher
    // portal expects: one entry per class the teacher is responsible for,
    // with all their responsibilities, streams, and learning areas folded in.
    const byClass = new Map<string, TeacherClass>();

    for (const alloc of allocations) {
      const classId = alloc.stream?.class?.id ?? alloc.class?.id;
      if (!classId) continue;

      let entry = byClass.get(classId);
      if (!entry) {
        const cls = alloc.stream?.class ?? alloc.class;
        if (!cls) continue;
        entry = {
          id: cls.id,
          name: cls.name,
          gradeLevel: cls.gradeLevel,
          academicYear: alloc.academicYear
            ? {
                id: alloc.academicYear.id,
                name: alloc.academicYear.name,
                label: alloc.academicYear.label ?? undefined,
              }
            : undefined,
          responsibilities: [],
          streams: [],
          learningAreas: [],
          learnerCount: 0,
        };
        byClass.set(classId, entry);
      }

      const isStreamLevel = Boolean(alloc.streamId);

      entry.responsibilities.push({
        type: isStreamLevel ? 'stream' : 'class',
        responsibility: alloc.responsibility as
          | 'main_class_teacher'
          | 'assistant_class_teacher'
          | 'subject_teacher',
        canManage: alloc.canManage,
        canEnterResults: alloc.canEnterResults,
        stream: alloc.stream
          ? {
              id: alloc.stream.id,
              name: alloc.stream.name,
              code: alloc.stream.code,
              class: {
                id: alloc.stream.class.id,
                name: alloc.stream.class.name,
                gradeLevel: alloc.stream.class.gradeLevel,
              },
            }
          : null,
        learningArea: alloc.subject
          ? {
              id: alloc.subject.id,
              name: alloc.subject.name,
              code: alloc.subject.code ?? undefined,
            }
          : undefined,
        effectiveFrom: alloc.effectiveFrom,
      });

      // Collect distinct streams for this class.
      if (alloc.stream) {
        if (!entry.streams.some((s) => s.id === alloc.stream!.id)) {
          entry.streams.push({
            id: alloc.stream.id,
            name: alloc.stream.name,
            code: alloc.stream.code,
            learnerCount: alloc.stream._count.enrollments,
          });
        }
      }

      // Collect distinct learning areas for this class.
      if (alloc.subject) {
        if (!entry.learningAreas.some((a) => a.id === alloc.subject!.id)) {
          entry.learningAreas.push({
            id: alloc.subject.id,
            name: alloc.subject.name,
            code: alloc.subject.code ?? undefined,
          });
        }
      }

      // Sum learners across the teacher's streams in this class. For class-level
      // allocations (no streams), read from the class enrollment count.
      if (alloc.stream && alloc.stream._count.enrollments > 0) {
        entry.learnerCount += alloc.stream._count.enrollments;
      }
    }

    // If any class still has zero learner count (e.g. class-level allocation
    // where the stream enrollment was not fetched), query the class directly.
    for (const entry of byClass.values()) {
      if (entry.learnerCount === 0 && entry.streams.length === 0) {
        const cls = await prisma.class.findUnique({
          where: { id: entry.id },
          select: { _count: { select: { enrollments: true } } },
        });
        if (cls) entry.learnerCount = cls._count.enrollments;
      }
    }

    const classes = [...byClass.values()].sort((a, b) => a.name.localeCompare(b.name));

    const metrics = computeMetrics(classes);

    res.json({
      classes,
      total: classes.length,
      metrics,
      scope: { schoolId, academicYearId: academicYearId ?? undefined },
    });
  })
);

/** The module landing endpoint — reports the module is live. */
router.get(
  '/',
  requireView,
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      service: 'schoolos-api',
      module: 'teachers',
      state: 'live',
      endpoints: ['/my-classes'],
    });
  })
);

function emptyMetrics() {
  return {
    totalClasses: 0,
    classTeacherClasses: 0,
    assistantClassTeacherClasses: 0,
    subjectTeacherClasses: 0,
    totalStreams: 0,
    totalLearningAreas: 0,
  };
}

function computeMetrics(classes: TeacherClass[]) {
  const classTeacherClasses = new Set<string>();
  const assistantClassTeacherClasses = new Set<string>();
  const subjectTeacherClasses = new Set<string>();
  const streams = new Set<string>();
  const learningAreas = new Set<string>();

  for (const cls of classes) {
    for (const resp of cls.responsibilities) {
      if (resp.responsibility === 'main_class_teacher') classTeacherClasses.add(cls.id);
      if (resp.responsibility === 'assistant_class_teacher') assistantClassTeacherClasses.add(cls.id);
      if (resp.responsibility === 'subject_teacher') subjectTeacherClasses.add(cls.id);
    }
    for (const s of cls.streams) streams.add(s.id);
    for (const a of cls.learningAreas) learningAreas.add(a.id);
  }

  return {
    totalClasses: classes.length,
    classTeacherClasses: classTeacherClasses.size,
    assistantClassTeacherClasses: assistantClassTeacherClasses.size,
    subjectTeacherClasses: subjectTeacherClasses.size,
    totalStreams: streams.size,
    totalLearningAreas: learningAreas.size,
  };
}

interface TeacherClass {
  id: string;
  name: string;
  gradeLevel: string | null;
  academicYear: { id: string; name: string; label?: string } | undefined;
  responsibilities: Array<{
    type: 'class' | 'stream';
    responsibility: string;
    canManage: boolean;
    canEnterResults: boolean;
    stream: {
      id: string;
      name: string;
      code: string;
      class: { id: string; name: string; gradeLevel: string | null };
    } | null;
    learningArea: { id: string; name: string; code?: string } | undefined;
    effectiveFrom: Date;
  }>;
  streams: Array<{ id: string; name: string; code: string; learnerCount: number }>;
  learningAreas: Array<{ id: string; name: string; code?: string }>;
  learnerCount: number;
}
