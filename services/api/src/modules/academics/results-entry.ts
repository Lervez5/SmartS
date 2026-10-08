/**
 * Results entry.
 *
 * Entering learner summative results by learning area, against one assessment
 * context: an academic session, a term, a grade, an assessment, a class and
 * optionally a stream.
 *
 * Everything the screen offers is derived from records the caller may already
 * see. The context options are scoped to the caller's school, the roster is the
 * class enrolment (optionally narrowed to a stream, which is a subdivision of
 * that class and never a class of its own), and the learning areas are the ones
 * the selected assessment actually covers.
 *
 * Results are `Grade` rows keyed by learner, learning area and assessment, so
 * saving upserts rather than appending, and an existing result is never
 * duplicated. A completed or archived assessment is locked: its results are
 * published, so the API refuses to change them rather than letting the interface
 * quietly overwrite what reviewers signed off.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { resolveBand } from '../academics/grading';
import { resolveClassResponsibility } from '../classes/scope';

export const router: Router = Router();

router.use(requireSchoolScope());

/** The maximum is part of the assessment, never a free value on the form. */
const contextSchema = z.object({
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  gradeLevel: z.string().optional(),
});

const gridSchema = z.object({
  classId: z.string().min(1),
  streamId: z.string().optional(),
});

const saveSchema = z.object({
  classId: z.string().min(1),
  results: z
    .array(
      z.object({
        studentId: z.string().min(1),
        subjectId: z.string().min(1),
        /** Null clears an entry; anything else must be within the maximum. */
        score: z.number().nullable(),
      })
    )
    .min(1)
    .max(2000),
});

/**
 * Whether this caller may enter results for a class.
 *
 * An administrative capability opens any class in their school; a teacher needs
 * an explicit assignment, resolved through the class teacher or assistant class
 * teacher record rather than from their role.
 */
async function assertMayEnterResults(
  user: { id: string; role: string },
  classId: string,
  subjectIds?: string[]
): Promise<{ scoped: boolean }> {
  if (user.role === 'SUPER_ADMIN') return { scoped: false };

  const responsibility = await resolveClassResponsibility(user.id, classId);
  if (!responsibility) throw new ApiError(404, 'Class not found in this school');
  if (!responsibility.hasAccess) {
    throw new ApiError(
      403,
      'You are not assigned to this class. Entering results requires the class teacher or assistant class teacher assignment, not the TEACHER role.'
    );
  }

  // Class responsibility alone is not enough. A teacher is responsible for a
  // class for every learning area, but only for the ones they are allocated to
  // teach, so marks are scoped to those assignments.
  if (subjectIds && subjectIds.length > 0) {
    const allocations = await prisma.teachingAssignment.findMany({
      where: {
        classId,
        teacherId: user.id,
        subjectId: { in: subjectIds },
        canEnterResults: true,
      },
      select: { subjectId: true },
    });
    const allocated = new Set(allocations.map((row) => row.subjectId));
    const notAllocated = subjectIds.filter((id) => !allocated.has(id));
    if (notAllocated.length > 0) {
      throw new ApiError(
        403,
        'You are not allocated to teach one or more of these learning areas in this class. Ask an administrator to record the teaching assignment.'
      );
    }
  }

  return { scoped: true };
}

/* ------------------------------------------------------------------ *
 * Context options
 * ------------------------------------------------------------------ */

router.get(
  '/context',
  requirePermissions('examinations.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = contextSchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);

    const [years, assessments, classes] = await Promise.all([
      prisma.academicYear.findMany({
        where: { schoolId },
        include: {
          terms: {
            select: { id: true, name: true, termNumber: true, startDate: true, endDate: true },
            orderBy: { termNumber: 'asc' },
          },
        },
        orderBy: { startDate: 'desc' },
      }),
      // Only assessments applicable to the chosen academic context.
      prisma.examination.findMany({
        where: {
          ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
          ...(query.termId ? { termId: query.termId } : {}),
          ...(query.gradeLevel ? { class: { gradeLevel: query.gradeLevel } } : {}),
          class: { schoolId },
          status: { not: 'archived' },
        },
        select: {
          id: true,
          title: true,
          assessmentType: true,
          status: true,
          maxScore: true,
          classId: true,
          class: { select: { id: true, name: true, gradeLevel: true } },
          learningAreas: { select: { subject: { select: { id: true, name: true, code: true } } } },
        },
        orderBy: { startDate: 'desc' },
      }),
      prisma.class.findMany({
        where: {
          schoolId,
          ...(query.gradeLevel ? { gradeLevel: query.gradeLevel } : {}),
        },
        select: {
          id: true,
          name: true,
          gradeLevel: true,
          // Streams are subdivisions of the class, listed with it so the
          // relationship is visible rather than implied.
          streams: {
            where: { status: 'active' },
            select: { id: true, name: true, code: true },
            orderBy: { code: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      sessions: years.map((year) => ({
        id: year.id,
        name: year.name,
        label: year.label ?? year.name,
        status: year.status,
        terms: year.terms,
      })),
      assessments: assessments.map((a) => ({
        id: a.id,
        title: a.title,
        assessmentType: a.assessmentType,
        status: a.status,
        // The maximum comes from the assessment; it is not editable here.
        maxScore: a.maxScore,
        classId: a.classId,
        className: a.class?.name ?? null,
        gradeLevel: a.class?.gradeLevel ?? null,
        learningAreaCount: a.learningAreas.length,
        learningAreaNames: a.learningAreas.map((row) => row.subject.name),
      })),
      classes: classes.map((cls) => ({
        id: cls.id,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        streams: cls.streams,
      })),
      // The grade list is derived from the school's classes, so it offers only
      // levels the school actually uses.
      gradeLevels: [
        ...new Set(classes.map((cls) => cls.gradeLevel).filter((g): g is string => Boolean(g))),
      ].sort(),
    });
  })
);

/* ------------------------------------------------------------------ *
 * The results grid
 * ------------------------------------------------------------------ */

router.get(
  '/:examinationId',
  requirePermissions('examinations.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = gridSchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);
    await assertMayEnterResults(req.user!, query.classId);

    const assessment = await prisma.examination.findFirst({
      where: { id: req.params.examinationId, class: { schoolId } },
      select: {
        id: true,
        title: true,
        status: true,
        maxScore: true,
        assessmentType: true,
        classId: true,
        class: { select: { id: true, name: true, gradeLevel: true } },
        term: { select: { id: true, termNumber: true } },
        academicYear: { select: { id: true, name: true, label: true } },
        learningAreas: {
          select: { subject: { select: { id: true, name: true, code: true } } },
          orderBy: { subject: { name: 'asc' } },
        },
      },
    });
    if (!assessment) throw new ApiError(404, 'Assessment not found in this school');

    // The class the grid is being entered for must be the assessment's class, or
    // marks could be recorded against learners who were never sitting it.
    if (assessment.classId !== query.classId) {
      throw new ApiError(
        409,
        `This assessment is set against ${assessment.class?.name ?? 'another class'}. Select that class to enter its results.`
      );
    }

    // Roster: the class enrolment, narrowed to a stream when one is chosen. A
    // stream is a subdivision of the class, so it never widens the population.
    const enrolments = await prisma.enrollment.findMany({
      where: {
        classId: query.classId,
        ...(query.streamId ? { streamId: query.streamId } : {}),
      },
      select: {
        studentId: true,
        stream: { select: { id: true, name: true, code: true } },
        student: {
          select: {
            id: true,
            name: true,
            firstName: true,
            lastName: true,
            studentProfile: { select: { id: true, gradeLevel: true } },
          },
        },
      },
      orderBy: { student: { name: 'asc' } },
    });

    const learners = enrolments
      .filter((row) => row.studentId && row.student)
      .map((row) => ({
        id: row.student!.id,
        name:
          row.student!.name ??
          [row.student!.firstName, row.student!.lastName].filter(Boolean).join(' '),
        gradeLevel: row.student!.studentProfile?.gradeLevel ?? null,
        stream: row.stream
          ? { id: row.stream.id, name: row.stream.name, code: row.stream.code }
          : null,
      }));

    const learningAreas = assessment.learningAreas.map((row) => row.subject);

    const existing = learners.length
      ? await prisma.grade.findMany({
          where: {
            examinationId: assessment.id,
            studentId: { in: learners.map((l) => l.id) },
            subjectId: { in: learningAreas.map((area) => area.id) },
          },
          select: {
            id: true,
            studentId: true,
            subjectId: true,
            value: true,
            competencyLevel: true,
            gradedAt: true,
          },
        })
      : [];

    const byCell = new Map(existing.map((row) => [`${row.studentId}:${row.subjectId}`, row]));

    return void res.json({
      assessment: {
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
        assessmentType: assessment.assessmentType,
        maxScore: assessment.maxScore,
        className: assessment.class?.name ?? null,
        gradeLevel: assessment.class?.gradeLevel ?? null,
        termNumber: assessment.term?.termNumber ?? null,
        sessionName: assessment.academicYear?.label ?? assessment.academicYear?.name ?? null,
      },
      learningAreas,
      locked: assessment.status === 'completed' || assessment.status === 'archived',
      rows: learners.map((learner) => ({
        learner,
        cells: learningAreas.map((area) => {
          const row = byCell.get(`${learner.id}:${area.id}`);
          return {
            subjectId: area.id,
            score: row ? row.value : null,
            competencyLevel: row?.competencyLevel ?? null,
            savedAt: row?.gradedAt ?? null,
          };
        }),
      })),
      summary: {
        learners: learners.length,
        learningAreas: learningAreas.length,
        cells: learners.length * learningAreas.length,
        recorded: existing.length,
      },
    });
  })
);

/* ------------------------------------------------------------------ *
 * Saving
 * ------------------------------------------------------------------ */

router.put(
  '/:examinationId',
  requirePermissions('grading.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = saveSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);
    const requestedSubjectIds = [...new Set(payload.results.map((result) => result.subjectId))];
    await assertMayEnterResults(req.user!, payload.classId, requestedSubjectIds);

    const assessment = await prisma.examination.findFirst({
      where: { id: req.params.examinationId, class: { schoolId } },
      select: {
        id: true,
        maxScore: true,
        status: true,
        classId: true,
        learningAreas: { select: { subjectId: true } },
      },
    });
    if (!assessment) throw new ApiError(404, 'Assessment not found in this school');

    if (assessment.status === 'completed' || assessment.status === 'archived') {
      throw new ApiError(
        409,
        `This assessment is ${assessment.status}, so its results are locked. Reopen it before entering marks.`
      );
    }
    if (assessment.classId !== payload.classId) {
      throw new ApiError(409, 'The class does not match the class this assessment is set against.');
    }

    // Learning areas: only the ones this assessment actually covers.
    const allowedSubjectIds = new Set(assessment.learningAreas.map((row) => row.subjectId));
    const disallowed = payload.results.filter((r) => !allowedSubjectIds.has(r.subjectId));
    if (disallowed.length > 0) {
      throw new ApiError(
        400,
        'Some results were for learning areas this assessment does not cover.'
      );
    }

    // Learners: only those enrolled in this class.
    const enrolments = await prisma.enrollment.findMany({
      where: { classId: payload.classId },
      select: { studentId: true },
    });
    const enrolled = new Set(
      enrolments.map((row) => row.studentId).filter((id): id is string => Boolean(id))
    );
    const notEnrolled = payload.results.filter((r) => !enrolled.has(r.studentId));
    if (notEnrolled.length > 0) {
      throw new ApiError(400, 'Some results were for learners not enrolled in this class.');
    }

    // Duplicate cells within one submission would race each other on the unique
    // key, so they are rejected rather than silently collapsed.
    const seen = new Set<string>();
    for (const result of payload.results) {
      const key = `${result.studentId}:${result.subjectId}`;
      if (seen.has(key)) {
        throw new ApiError(400, `Duplicate result for the same learner and learning area.`);
      }
      seen.add(key);
    }

    const max = assessment.maxScore;
    const over = payload.results.find((r) => r.score !== null && max !== null && r.score > max);
    if (over) {
      throw new ApiError(
        400,
        `A score of ${over.score} exceeds this assessment's maximum of ${max}.`
      );
    }
    const negative = payload.results.find((r) => r.score !== null && r.score < 0);
    if (negative) {
      throw new ApiError(400, 'A score cannot be negative.');
    }

    const bands = await prisma.competencyBand.findMany({
      where: { schoolId },
      orderBy: { minPercent: 'desc' },
    });

    // Upsert keyed on learner + learning area + assessment, so saving twice
    // updates rather than appending and no result is duplicated.
    const existingRows = await prisma.grade.findMany({
      where: {
        examinationId: assessment.id,
        OR: payload.results.map((r) => ({ studentId: r.studentId, subjectId: r.subjectId })),
      },
      select: { id: true, studentId: true, subjectId: true },
    });
    const existingByCell = new Map(
      existingRows.map((row) => [`${row.studentId}:${row.subjectId}`, row.id])
    );

    let saved = 0;
    let cleared = 0;

    // Interactive rather than the array form: each result depends on whether a
    // row already exists, so the upserts cannot be a flat list of promises.
    await prisma.$transaction(async (tx) => {
      for (const result of payload.results) {
        const key = `${result.studentId}:${result.subjectId}`;
        const existingId = existingByCell.get(key);

        // A cleared cell is removed rather than stored as an empty grade, so it
        // stops counting towards completion.
        if (result.score === null) {
          if (existingId) {
            await tx.grade.delete({ where: { id: existingId } });
            cleared += 1;
          }
          continue;
        }

        const percent = max !== null && max > 0 ? (result.score / max) * 100 : null;
        const band = percent === null ? null : resolveBand(percent, bands);

        const data = {
          studentId: result.studentId,
          subjectId: result.subjectId,
          classId: payload.classId,
          examinationId: assessment.id,
          scale: 'percentage' as const,
          value: result.score,
          competencyLevel: band?.level ?? null,
          competencyBandId: band?.bandId ?? null,
          gradedBy: req.user!.id,
        };

        if (existingId) {
          await tx.grade.update({ where: { id: existingId }, data });
        } else {
          await tx.grade.create({ data });
        }
        saved += 1;
      }
    });

    res.json({ saved, cleared, locked: false });
  })
);
