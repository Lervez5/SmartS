import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { AssessmentStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

/**
 * Summative assessments.
 *
 * An examination is tied to the authoritative academic context — the AcademicYear
 * and Term the navbar selects — so the same session and term resolve here as
 * everywhere else in the admin portal. Grade comes from the class it is set
 * against, and the subject is the learning-area analogue the schema carries.
 *
 * Marks entry is `PUT /:id/marks`. An attempt has to exist before it can be
 * scored, and attempts are seeded from the class enrolment rather than created
 * by hand, so a score can only ever be recorded for a learner who was actually
 * sitting the assessment.
 */

const router: Router = Router();
export { router };

const assessmentStatus = z.nativeEnum(AssessmentStatus);

const listSchema = z.object({
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  assessmentType: z.string().optional(),
  status: assessmentStatus.optional(),
  search: z.string().optional(),
  sort: z.enum(['date_desc', 'date_asc', 'title_asc', 'title_desc', 'created_desc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z
  .object({
    title: z.string().min(1).max(160),
    description: z.string().max(2000).optional(),
    academicYearId: z.string().optional(),
    termId: z.string().optional(),
    classId: z.string().optional(),
    subjectId: z.string().optional(),
    assessmentType: z.string().max(64).optional(),
    status: assessmentStatus.optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
    duration: z.coerce.number().int().min(1).max(1440).optional(),
    maxScore: z.coerce.number().min(0).optional(),
  })
  .refine((value) => !value.endDate || new Date(value.endDate) > new Date(value.startDate), {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });

const updateSchema = z
  .object({
    title: z.string().min(1).max(160).optional(),
    description: z.string().max(2000).optional(),
    academicYearId: z.string().nullable().optional(),
    termId: z.string().nullable().optional(),
    classId: z.string().nullable().optional(),
    subjectId: z.string().nullable().optional(),
    assessmentType: z.string().max(64).nullable().optional(),
    status: assessmentStatus.optional(),
    startDate: z.string().optional(),
    endDate: z.string().nullable().optional(),
    duration: z.coerce.number().int().min(1).max(1440).nullable().optional(),
    maxScore: z.coerce.number().min(0).nullable().optional(),
  })
  .refine(
    (value) =>
      !(value.startDate && value.endDate) ||
      new Date(value.endDate as string) > new Date(value.startDate),
    { message: 'End date must be after the start date', path: ['endDate'] }
  );

/**
 * Marks entry payload.
 *
 * `studentId` is the User id, because that is what ExamAttempt records. A score
 * is required once an attempt is marked graded, so a half-entered mark cannot be
 * stored.
 */
const marksSchema = z.object({
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        score: z.number().nullable(),
        graded: z.boolean().optional(),
      })
    )
    .min(1)
    .max(500),
  submit: z.boolean().optional(),
});

const listInclude = {
  class: { select: { id: true, name: true, gradeLevel: true } },
  subject: { select: { id: true, name: true } },
  academicYear: { select: { id: true, name: true, label: true } },
  term: { select: { id: true, name: true, termNumber: true } },
  _count: { select: { examAttempts: true } },
} as const;

function present(exam: {
  id: string;
  title: string;
  description: string | null;
  status: AssessmentStatus;
  assessmentType: string | null;
  startDate: Date;
  endDate: Date | null;
  duration: number | null;
  maxScore: number | null;
  classId: string | null;
  subjectId: string | null;
  academicYearId: string | null;
  termId: string | null;
  class: { id: string; name: string; gradeLevel: string | null } | null;
  subject: { id: string; name: string } | null;
  academicYear: { id: string; name: string; label: string | null } | null;
  term: { id: string; name: string; termNumber: number } | null;
  _count: { examAttempts: number };
}) {
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    status: exam.status,
    assessmentType: exam.assessmentType,
    startDate: exam.startDate,
    endDate: exam.endDate,
    duration: exam.duration,
    maxScore: exam.maxScore,
    class: exam.class,
    subject: exam.subject,
    academicYear: exam.academicYear,
    term: exam.term,
    academicYearId: exam.academicYearId,
    termId: exam.termId,
    classId: exam.classId,
    subjectId: exam.subjectId,
    attemptCount: exam._count.examAttempts,
  };
}

/** Derived from dates, so a draft is never shown as in progress by accident. */
function lifecycleStatus(exam: {
  status: AssessmentStatus;
  startDate: Date;
  endDate: Date | null;
}): 'draft' | 'scheduled' | 'open' | 'closed' | 'completed' | 'archived' {
  if (exam.status === 'draft') return 'draft';
  if (exam.status === 'archived') return 'archived';
  if (exam.status === 'completed') return 'completed';
  const now = Date.now();
  if (exam.startDate.getTime() > now) return 'scheduled';
  if (exam.endDate && exam.endDate.getTime() < now) return 'closed';
  return 'open';
}

router.get(
  '/',
  requirePermissions('examinations.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const orderBy = {
      date_desc: { startDate: 'desc' as const },
      date_asc: { startDate: 'asc' as const },
      title_asc: { title: 'asc' as const },
      title_desc: { title: 'desc' as const },
      created_desc: { createdAt: 'desc' as const },
    }[query.sort ?? 'date_desc'];

    const examinations = await prisma.examination.findMany({
      where: {
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
        ...(query.termId ? { termId: query.termId } : {}),
        ...(query.assessmentType ? { assessmentType: query.assessmentType } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
                { assessmentType: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: listInclude,
      orderBy,
      ...(query.limit ? { take: query.limit } : {}),
    });

    res.json({
      examinations: examinations.map((exam) => ({
        ...present(exam),
        lifecycle: lifecycleStatus(exam),
      })),
    });
  })
);

/**
 * Filter options, derived from what the school actually uses.
 *
 * Grade comes from the classes examinations are set against, term from the
 * terms attached to those assessments, and type from the distinct types in use.
 * Nothing here is a hardcoded list.
 */
router.get(
  '/options',
  requirePermissions('examinations.view'),
  asyncHandler(async (_req: Request, res: Response) => {
    const [types, classes, terms] = await Promise.all([
      prisma.examination.findMany({
        where: { assessmentType: { not: null } },
        distinct: ['assessmentType'],
        select: { assessmentType: true },
      }),
      prisma.examination.findMany({
        select: { class: { select: { id: true, name: true, gradeLevel: true } } },
      }),
      prisma.examination.findMany({
        select: { term: { select: { id: true, name: true, termNumber: true } } },
      }),
    ]);

    const gradeMap = new Map<string, { value: string; label: string; classId: string }>();
    for (const row of classes) {
      if (!row.class) continue;
      gradeMap.set(row.class.id, {
        value: row.class.id,
        label: [row.class.name, row.class.gradeLevel].filter(Boolean).join(' — '),
        classId: row.class.id,
      });
    }

    const termMap = new Map<string, { value: string; label: string }>();
    for (const row of terms) {
      if (!row.term) continue;
      termMap.set(row.term.id, {
        value: row.term.id,
        label: `Term ${row.term.termNumber}${row.term.name ? ` · ${row.term.name}` : ''}`,
      });
    }

    res.json({
      assessmentTypes: types
        .map((row) => row.assessmentType)
        .filter((value): value is string => Boolean(value))
        .sort()
        .map((value) => ({ value, label: value })),
      grades: [...gradeMap.values()].sort((a, b) => a.label.localeCompare(b.label)),
      terms: [...termMap.values()].sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { numeric: true })
      ),
    });
  })
);

router.get(
  '/:id',
  requirePermissions('examinations.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const exam = await prisma.examination.findUnique({
      where: { id: req.params.id },
      include: {
        ...listInclude,
        examAttempts: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                firstName: true,
                lastName: true,
                email: true,
                studentProfile: { select: { id: true, gradeLevel: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!exam) throw new ApiError(404, 'Assessment not found');

    const attempts = exam.examAttempts.map((attempt) => ({
      id: attempt.id,
      studentId: attempt.studentId,
      name:
        attempt.student?.name ??
        [attempt.student?.firstName, attempt.student?.lastName].filter(Boolean).join(' '),
      email: attempt.student?.email ?? '',
      score: attempt.score,
      graded: attempt.graded,
      submittedAt: attempt.submittedAt,
      profileId: attempt.student?.studentProfile?.id ?? null,
    }));

    const scored = attempts.filter((a) => a.score !== null);
    const average =
      scored.length > 0 && exam.maxScore
        ? Math.round(
            (scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length / exam.maxScore) *
              100
          )
        : null;

    const { examAttempts, ...rest } = exam;
    void examAttempts;

    res.json({
      assessment: {
        ...present(rest),
        lifecycle: lifecycleStatus(rest),
        attempts,
        scoredCount: scored.length,
        averagePercent: average,
      },
    });
  })
);

router.post(
  '/',
  requirePermissions('examinations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);

    const exam = await prisma.examination.create({
      data: {
        title: payload.title,
        description: payload.description,
        status: payload.status ?? 'draft',
        assessmentType: payload.assessmentType,
        academicYearId: payload.academicYearId,
        termId: payload.termId,
        classId: payload.classId,
        subjectId: payload.subjectId,
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        duration: payload.duration,
        maxScore: payload.maxScore,
      },
      include: listInclude,
    });

    res.status(201).json({ assessment: { ...present(exam), lifecycle: lifecycleStatus(exam) } });
  })
);

router.patch(
  '/:id',
  requirePermissions('examinations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateSchema.parse(req.body);
    const existing = await prisma.examination.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Assessment not found');

    const nextStart = payload.startDate ? new Date(payload.startDate) : existing.startDate;
    const nextEnd =
      payload.endDate === undefined
        ? existing.endDate
        : payload.endDate
          ? new Date(payload.endDate)
          : null;
    if (nextEnd && nextEnd <= nextStart) {
      throw new ApiError(400, 'End date must be after the start date');
    }

    // Marks are locked once an assessment is completed, so a completed
    // assessment cannot be quietly re-edited underneath published results.
    if (payload.status && payload.status !== existing.status) {
      if (existing.status === 'completed') {
        throw new ApiError(
          409,
          'This assessment is completed. Reopen it before changing its lifecycle state.'
        );
      }
    }

    const exam = await prisma.examination.update({
      where: { id: req.params.id },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.assessmentType !== undefined
          ? { assessmentType: payload.assessmentType || null }
          : {}),
        ...(payload.academicYearId !== undefined
          ? { academicYearId: payload.academicYearId || null }
          : {}),
        ...(payload.termId !== undefined ? { termId: payload.termId || null } : {}),
        ...(payload.classId !== undefined ? { classId: payload.classId || null } : {}),
        ...(payload.subjectId !== undefined ? { subjectId: payload.subjectId || null } : {}),
        ...(payload.startDate !== undefined ? { startDate: new Date(payload.startDate) } : {}),
        ...(payload.endDate !== undefined
          ? { endDate: payload.endDate ? new Date(payload.endDate) : null }
          : {}),
        ...(payload.duration !== undefined ? { duration: payload.duration } : {}),
        ...(payload.maxScore !== undefined ? { maxScore: payload.maxScore } : {}),
      },
      include: listInclude,
    });

    res.json({ assessment: { ...present(exam), lifecycle: lifecycleStatus(exam) } });
  })
);

/**
 * Seed attempts from the class enrolment.
 *
 * Marks can only be recorded against an attempt, and an attempt should only
 * exist for a learner who was actually sitting the assessment — so attempts are
 * derived from Enrollment rather than typed in by hand.
 */
router.post(
  '/:id/attempts',
  requirePermissions('examinations.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const exam = await prisma.examination.findUnique({
      where: { id: req.params.id },
      include: { examAttempts: { select: { studentId: true } } },
    });
    if (!exam) throw new ApiError(404, 'Assessment not found');
    if (!exam.classId) {
      throw new ApiError(
        400,
        'This assessment has no class, so there is no enrolment to take attempts from.'
      );
    }

    const enrolments = await prisma.enrollment.findMany({
      where: { classId: exam.classId },
      select: { studentId: true },
    });

    const existing = new Set(exam.examAttempts.map((a) => a.studentId));
    const missing = enrolments
      .map((e) => e.studentId)
      .filter((id): id is string => Boolean(id) && !existing.has(id));

    if (missing.length === 0) {
      res.json({ created: 0, total: exam.examAttempts.length });
      return;
    }

    await prisma.examAttempt.createMany({
      data: missing.map((studentId) => ({ examinationId: exam.id, studentId })),
    });

    res.status(201).json({
      created: missing.length,
      total: exam.examAttempts.length + missing.length,
    });
  })
);

/**
 * Record marks.
 *
 * Upserts by student so the whole roster can be submitted in one call. A score
 * requires `graded`, so a half-entered mark cannot be stored as final.
 */
router.put(
  '/:id/marks',
  requirePermissions('grading.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = marksSchema.parse(req.body);

    const exam = await prisma.examination.findUnique({
      where: { id: req.params.id },
      include: { examAttempts: { select: { id: true, studentId: true } } },
    });
    if (!exam) throw new ApiError(404, 'Assessment not found');

    if (exam.status === 'completed' || exam.status === 'archived') {
      throw new ApiError(
        409,
        `This assessment is ${exam.status}, so its marks are locked. Reopen it before entering marks.`
      );
    }

    if (exam.maxScore) {
      const over = payload.records.find(
        (record) => record.score !== null && record.score > exam.maxScore!
      );
      if (over) {
        throw new ApiError(
          400,
          `A score of ${over.score} exceeds the maximum of ${exam.maxScore} for this assessment.`
        );
      }
    }

    const byStudent = new Map(
      exam.examAttempts
        .filter((attempt) => attempt.studentId)
        .map((attempt) => [attempt.studentId as string, attempt.id])
    );

    const unknown = payload.records
      .filter((record) => !byStudent.has(record.studentId))
      .map((record) => record.studentId);
    if (unknown.length > 0) {
      throw new ApiError(
        400,
        'Those learners have no attempt on this assessment. Seed attempts from the class enrolment first.'
      );
    }

    const graded = payload.records.filter((record) => record.graded !== false);
    const invalid = graded.find((record) => record.score === null);
    if (invalid) {
      throw new ApiError(400, 'A learner cannot be marked graded without a score.');
    }

    const updated = await prisma.$transaction(
      payload.records.map((record) =>
        prisma.examAttempt.update({
          where: { id: byStudent.get(record.studentId)! },
          data: {
            score: record.score,
            graded: record.graded ?? false,
            ...(payload.submit && record.graded !== false ? { submittedAt: new Date() } : {}),
          },
        })
      )
    );

    res.json({ saved: updated.length });
  })
);
