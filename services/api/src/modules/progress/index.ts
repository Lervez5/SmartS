/**
 * Learner Progress — the teacher's workspace for monitoring, recording and
 * reviewing how each authorised learner is developing over time.
 *
 * This module does NOT own a parallel marks store or a second grading engine.
 * It surfaces evidence that already lives in the platform:
 *
 *   - Grades (marks + resolved RaceField band + points + CBC competency level)
 *     from the Examination → Grade rows that the results-entry module writes.
 *   - Teacher-authored ProgressObservation rows, which are kept deliberately
 *     separate from Grade rows so an observation can never overwrite a mark.
 *
 * Access is scoped through the same `StreamAllocation` records that drive
 * attendance and results. A class-wide allocation sees every stream; a
 * stream-specific one never exposes sibling streams.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';
import {
  resolveClassResultsScopesForSchool,
  ClassResultsScope,
  currentSessionId,
} from '../academics/allocation/scope';

export const router: Router = Router();

router.use(requireSchoolScope());
router.use(requirePermissions('progress.view'));

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function assertObjectId(value: string, label = 'id'): string {
  if (!OBJECT_ID.test(value)) {
    throw new ApiError(400, `${label} must be a valid identifier`);
  }
  return value;
}

function academicYearResolved(value: string | null | undefined): boolean {
  return Boolean(value);
}

/**
 * Given a teacher's resolved class scopes, return the set of learner user IDs
 * they are responsible for within the requested session/term filters.
 *
 * - A class-wide scope (allStreams = true) returns every enrollee.
 * - A stream-specific scope returns only enrollees in the assigned streams.
 */
async function resolveScopedLearners(
  scopes: Map<string, ClassResultsScope>,
  opts: { academicYearId?: string; termId?: string }
): Promise<Array<{ learnerId: string; classId: string; streamId: string | null }>> {
  const learnerRows: Array<{ learnerId: string; classId: string; streamId: string | null }> = [];

  for (const [classId, scope] of scopes) {
    if (!scope.hasAccess) continue;

    // The class is already scoped to the teacher's allocation, so enrollment rows
    // for it are in scope. The academicYearId filter is not applied here because
    // many enrollment records do not carry a session reference (they inherit the
    // class's session), and Prisma's MongoDB connector cannot match missing
    // fields via a null in an OR clause. The session context is established
    // server-side from the class's own academic-year association.
    const where: Prisma.EnrollmentWhereInput = { classId };
    if (scope.allStreams) {
      // Class-wide — every stream.
    } else if (scope.streamIds.length > 0) {
      where.streamId = { in: scope.streamIds };
    } else {
      continue;
    }

    const rows = await prisma.enrollment.findMany({
      where,
      select: { studentId: true, classId: true, streamId: true },
    });

    for (const row of rows) {
      if (row.studentId) {
        learnerRows.push({
          learnerId: row.studentId,
          classId: row.classId,
          streamId: row.streamId,
        });
      }
    }
  }

  return learnerRows;
}

/**
 * GET /api/progress/learners
 *
 * Lists every learner the caller is authorised to see, grouped by class, for
 * the requested (or current) academic session and term. Only classes the
 * caller has a teaching allocation for are considered.
 */
router.get(
  '/learners',
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Sign in to view learner progress.');
    }

    const querySchema = z.object({
      academicYearId: z.string().optional(),
      termId: z.string().optional(),
    });
    const query = querySchema.parse(req.query);

    // Resolve the session: explicit filter, otherwise the school's active one.
    const academicYearId = query.academicYearId
      ? assertObjectId(query.academicYearId, 'academicYearId')
      : await currentSessionId(schoolId);

    if (!academicYearId) {
      res.json({
        learners: [],
        classes: [],
        note: 'No academic session configured for this school.',
      });
      return;
    }

    // Get the caller's resolved scope across every class in the school.
    const scopes = await resolveClassResultsScopesForSchool(
      teacherId,
      schoolId,
      req.user?.permissions
    );

    const scopedLearners = await resolveScopedLearners(scopes, {
      academicYearId,
      ...(query.termId ? { termId: assertObjectId(query.termId, 'termId') } : {}),
    });

    // Fetch learner + class + stream details in a single batch.
    const learnerIds = [...new Set(scopedLearners.map((l) => l.learnerId))];
    const classIds = [...new Set(scopedLearners.map((l) => l.classId))];

    const [learners, classes, subjects] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: learnerIds }, schoolMemberships: { some: { schoolId } } },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          studentProfile: { select: { gradeLevel: true } },
        },
      }),
      prisma.class.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true, gradeLevel: true, subjectId: true },
      }),
      prisma.subject.findMany({
        where: { schoolId, status: 'active' },
        select: { id: true, name: true, code: true },
      }),
    ]);

    // Build a lookup: learnerId → [{ classId, streamId, className, gradeLevel }]
    const byLearner = new Map<
      string,
      Array<{
        classId: string;
        streamId: string | null;
        className: string;
        gradeLevel: string | null;
      }>
    >();
    for (const mapping of scopedLearners) {
      const cls = classes.find((c) => c.id === mapping.classId);
      const arr = byLearner.get(mapping.learnerId) ?? [];
      arr.push({
        classId: mapping.classId,
        streamId: mapping.streamId,
        className: cls?.name ?? '',
        gradeLevel: cls?.gradeLevel ?? null,
      });
      byLearner.set(mapping.learnerId, arr);
    }

    res.json({
      learners: learners.map((u) => ({
        ...u,
        classes: byLearner.get(u.id) ?? [],
      })),
      subjects: subjects,
      academicYearId,
      note: scopedLearners.length === 0 ? 'You have no learners in this session.' : undefined,
    });
  })
);

/**
 * GET /api/progress/learner/:learnerId
 *
 * Returns the full progress history for a single learner within the caller's
 * authorised scope. Aggregates:
 *   - Published/completed examinations for the learner's class + session/term
 *   - Grade rows (marks, resolved RaceField band/points, competency level)
 *   - ProgressObservation rows authored by (or visible to) the caller
 *
 * All IDs are resolved through the teacher's allocation scope — client-supplied
 * learner/class/stream identifiers are never trusted for authorisation.
 */
router.get(
  '/learner/:learnerId',
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Sign in to view learner progress.');
    }

    const learnerId = assertObjectId(req.params.learnerId, 'learnerId');

    const querySchema = z.object({
      academicYearId: z.string().optional(),
      termId: z.string().optional(),
      classId: z.string().optional(),
      subjectId: z.string().optional(),
    });
    const query = querySchema.parse(req.query);

    const academicYearId = query.academicYearId
      ? assertObjectId(query.academicYearId, 'academicYearId')
      : await currentSessionId(schoolId);

    if (!academicYearId) {
      throw new ApiError(400, 'No academic session configured for this school.');
    }

    // Resolve scope and verify the learner is in it.
    const scopes = await resolveClassResultsScopesForSchool(
      teacherId,
      schoolId,
      req.user?.permissions
    );

    const scopedLearners = await resolveScopedLearners(scopes, { academicYearId });
    const learnerClassIds = scopedLearners
      .filter((l) => l.learnerId === learnerId)
      .map((l) => l.classId);

    if (learnerClassIds.length === 0) {
      throw new ApiError(403, "You are not authorised to view this learner's progress.");
    }

    if (query.classId && !learnerClassIds.includes(query.classId)) {
      throw new ApiError(403, 'You are not authorised to view this learner in this class.');
    }

    // Fetch the learner's profile (server-side, not trusting client).
    const learner = await prisma.user.findFirst({
      where: {
        id: learnerId,
        schoolMemberships: { some: { schoolId } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        studentProfile: { select: { gradeLevel: true, dateOfBirth: true, gender: true } },
      },
    });

    if (!learner) {
      throw new ApiError(404, 'Learner not found.');
    }

    // Fetch all grades for this learner across their authorised classes.
    const gradeWhere: Prisma.GradeWhereInput = {
      studentId: learnerId,
      class: {
        schoolId,
        ...(academicYearId ? { academicYearId } : {}),
      },
      ...(query.termId ? { exam: { termId: assertObjectId(query.termId, 'termId') } } : {}),
      ...(query.classId ? { classId: query.classId } : { classId: { in: learnerClassIds } }),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
    };

    const grades = await prisma.grade.findMany({
      where: gradeWhere,
      select: {
        id: true,
        value: true,
        scale: true,
        competencyLevel: true,
        racefieldBandCode: true,
        racefieldPoints: true,
        comment: true,
        gradedAt: true,
        class: { select: { id: true, name: true, gradeLevel: true } },
        subject: { select: { id: true, name: true, code: true } },
        exam: {
          select: {
            id: true,
            title: true,
            assessmentType: true,
            status: true,
            maxScore: true,
            startDate: true,
            endDate: true,
            term: { select: { id: true, name: true, termNumber: true } },
            academicYear: { select: { id: true, name: true, label: true } },
          },
        },
      },
      orderBy: { gradedAt: 'desc' },
    });

    // Fetch observations authored by this teacher for this learner.
    const observations = await prisma.progressObservation.findMany({
      where: {
        learnerId,
        teacherId,
        schoolId,
        ...(query.classId ? { classId: query.classId } : { classId: { in: learnerClassIds } }),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.academicYearId
          ? { academicYearId: assertObjectId(query.academicYearId, 'academicYearId') }
          : {}),
        ...(query.termId ? { termId: assertObjectId(query.termId, 'termId') } : {}),
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        term: { select: { id: true, name: true, termNumber: true } },
        academicYear: { select: { id: true, name: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build a learning-area summary: per-subject average + latest grade.
    const bySubject = new Map<
      string,
      { subject: { id: string; name: string; code: string | null }; grades: typeof grades }
    >();
    for (const g of grades) {
      if (!g.subject) continue;
      const key = g.subject.id;
      const entry = bySubject.get(key) ?? { subject: g.subject, grades: [] };
      entry.grades.push(g);
      bySubject.set(key, entry);
    }

    res.json({
      learner: {
        ...learner,
        classes: learnerClassIds.map((id) => {
          const cls = scopes.get(id);
          return {
            classId: id,
            allStreams: cls?.allStreams ?? false,
            entersAllAreas: cls?.entersAllAreas ?? false,
          };
        }),
      },
      academicYearId,
      grades,
      observations,
      subjectSummaries: [...bySubject.values()].map((entry) => {
        const values = entry.grades.map((g) => g.value).filter((v): v is number => v !== null);
        const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
        return {
          subjectId: entry.subject.id,
          subjectName: entry.subject.name,
          subjectCode: entry.subject.code,
          assessmentCount: entry.grades.length,
          average: avg,
          latest: entry.grades[0],
          latestBandCode: entry.grades[0]?.racefieldBandCode ?? null,
          latestPoints: entry.grades[0]?.racefieldPoints ?? null,
          latestCompetency: entry.grades[0]?.competencyLevel ?? null,
        };
      }),
    });
  })
);

/**
 * POST /api/progress/observation
 *
 * Creates a progress observation for a learner the caller is authorised to
 * see. The classId and subjectId are server-resolved through the caller's
 * scope — a teacher cannot observe a learner outside their allocation.
 */
const createObservationSchema = z.object({
  learnerId: z.string().min(1),
  classId: z.string().min(1),
  termId: z.string().optional(),
  subjectId: z.string().optional(),
  text: z.string().trim().min(1, 'Observation text is required.').max(2000),
  visibility: z.enum(['draft', 'finalised']).optional(),
});

router.post(
  '/observation',
  requirePermissions('progress.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Sign in to record observations.');
    }

    const payload = createObservationSchema.parse(req.body);
    assertObjectId(payload.learnerId, 'learnerId');
    assertObjectId(payload.classId, 'classId');
    const termId = payload.termId ? assertObjectId(payload.termId, 'termId') : undefined;
    const subjectId = payload.subjectId
      ? assertObjectId(payload.subjectId, 'subjectId')
      : undefined;

    // Resolve scope and verify the learner is in this class for this teacher.
    const scopes = await resolveClassResultsScopesForSchool(
      teacherId,
      schoolId,
      req.user?.permissions
    );
    const learnerClassIds = (await resolveScopedLearners(scopes, {})).filter(
      (l) => l.learnerId === payload.learnerId
    );

    if (!learnerClassIds.some((l) => l.classId === payload.classId)) {
      throw new ApiError(
        403,
        'You are not authorised to record observations for this learner in this class.'
      );
    }

    // Verify the academic year on the class.
    const cls = await prisma.class.findUnique({
      where: { id: payload.classId },
      select: { academicYearId: true },
    });
    if (!cls) throw new ApiError(404, 'Class not found.');

    if (subjectId) {
      // Verify the subject is within the teacher's scope for this class.
      const scope = scopes.get(payload.classId);
      const allowed = scope?.entersAllAreas
        ? true
        : (scope?.allowedSubjectIds?.includes(subjectId) ?? false);
      if (!allowed) {
        throw new ApiError(
          403,
          'You are not allocated to enter observations for this learning area.'
        );
      }
    }

    // Verify the learner is enrolled in this class.
    const enrolled = await prisma.enrollment.findFirst({
      where: {
        classId: payload.classId,
        studentId: payload.learnerId,
        ...(academicYearResolved(cls.academicYearId) ? { academicYearId: cls.academicYearId } : {}),
      },
    });
    if (!enrolled) throw new ApiError(404, 'Learner is not enrolled in this class.');

    const observation = await prisma.progressObservation.create({
      data: {
        schoolId,
        teacherId,
        learnerId: payload.learnerId,
        classId: payload.classId,
        subjectId,
        academicYearId: cls.academicYearId,
        termId,
        text: payload.text,
        visibility: payload.visibility ?? 'draft',
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        term: { select: { id: true, name: true, termNumber: true } },
        academicYear: { select: { id: true, name: true, label: true } },
      },
    });

    await recordAuditLog(
      teacherId,
      'CREATE_PROGRESS_OBSERVATION',
      `Recorded a progress observation for learner ${payload.learnerId} in class ${payload.classId}`
    );

    res.status(201).json({ observation });
  })
);

/**
 * PATCH /api/progress/observation/:id
 *
 * Updates an observation — only the authoring teacher may do this.
 */
router.patch(
  '/observation/:id',
  requirePermissions('progress.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Sign in to edit observations.');
    }

    const observationId = assertObjectId(req.params.id, 'id');

    const payload = createObservationSchema.partial().parse(req.body);

    const existing = await prisma.progressObservation.findUnique({
      where: { id: observationId },
      select: { id: true, teacherId: true, schoolId: true },
    });

    if (!existing) {
      throw new ApiError(404, 'Observation not found.');
    }
    if (existing.schoolId !== schoolId) {
      throw new ApiError(403, 'You are not authorised to edit this observation.');
    }
    if (existing.teacherId !== teacherId) {
      throw new ApiError(403, 'Only the author of this observation can edit it.');
    }

    const updateData: Record<string, unknown> = {};
    if (payload.text !== undefined) {
      if (payload.text.trim().length === 0) {
        throw new ApiError(400, 'Observation text cannot be empty.');
      }
      updateData.text = payload.text.trim();
    }
    if (payload.subjectId !== undefined && payload.subjectId) {
      updateData.subjectId = assertObjectId(payload.subjectId, 'subjectId');
    } else if (payload.subjectId === '') {
      updateData.subjectId = null;
    }
    if (payload.termId !== undefined && payload.termId) {
      updateData.termId = assertObjectId(payload.termId, 'termId');
    } else if (payload.termId === '') {
      updateData.termId = null;
    }
    if (payload.visibility !== undefined) {
      updateData.visibility = payload.visibility;
    }

    const updated = await prisma.progressObservation.update({
      where: { id: observationId },
      data: updateData,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        term: { select: { id: true, name: true, termNumber: true } },
        academicYear: { select: { id: true, name: true, label: true } },
      },
    });

    await recordAuditLog(
      teacherId,
      'UPDATE_PROGRESS_OBSERVATION',
      `Updated progress observation ${observationId}`
    );

    res.json({ observation: updated });
  })
);

/**
 * DELETE /api/progress/observation/:id
 *
 * Deletes an observation — only the authoring teacher, or a manager, may do this.
 */
router.delete(
  '/observation/:id',
  requirePermissions('progress.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Sign in to delete observations.');
    }

    const observationId = assertObjectId(req.params.id, 'id');

    const existing = await prisma.progressObservation.findUnique({
      where: { id: observationId },
      select: { id: true, teacherId: true, schoolId: true, learnerId: true, classId: true },
    });

    if (!existing) {
      throw new ApiError(404, 'Observation not found.');
    }

    const isManager = (req.user?.permissions ?? []).includes('progress.manage');
    if (existing.schoolId !== schoolId) {
      throw new ApiError(403, 'You are not authorised to delete this observation.');
    }
    if (existing.teacherId !== teacherId && !isManager) {
      throw new ApiError(403, 'Only the author of this observation can delete it.');
    }

    await prisma.progressObservation.delete({ where: { id: observationId } });

    await recordAuditLog(
      teacherId,
      'DELETE_PROGRESS_OBSERVATION',
      `Deleted progress observation for learner ${existing.learnerId} in class ${existing.classId}`
    );

    res.status(204).end();
  })
);

/**
 * GET /api/progress/observations
 *
 * Lists observations for a class or learner within the caller's scope.
 * Query params: learnerId, classId, academicYearId, termId
 */
router.get(
  '/observations',
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const teacherId = req.user?.id;
    if (!teacherId) {
      throw new ApiError(401, 'Sign in to view observations.');
    }

    const querySchema = z.object({
      learnerId: z.string().optional(),
      classId: z.string().optional(),
      academicYearId: z.string().optional(),
      termId: z.string().optional(),
    });
    const query = querySchema.parse(req.query);

    const scopes = await resolveClassResultsScopesForSchool(
      teacherId,
      schoolId,
      req.user?.permissions
    );
    const scopedLearners = await resolveScopedLearners(scopes, {});

    const learnerClassIds = [...new Set(scopedLearners.map((l) => l.classId))];
    if (learnerClassIds.length === 0) {
      res.json({ observations: [] });
      return;
    }

    const learnerId = query.learnerId ? assertObjectId(query.learnerId, 'learnerId') : undefined;
    const classId = query.classId ? assertObjectId(query.classId, 'classId') : undefined;
    const termId = query.termId ? assertObjectId(query.termId, 'termId') : undefined;

    // Verify the requested scope is within the teacher's authorisation.
    if (classId && !learnerClassIds.includes(classId)) {
      throw new ApiError(403, 'You are not authorised to view observations for this class.');
    }
    if (learnerId && !scopedLearners.some((l) => l.learnerId === learnerId)) {
      throw new ApiError(403, 'You are not authorised to view observations for this learner.');
    }

    const where: Prisma.ProgressObservationWhereInput = {
      schoolId,
      teacherId,
      ...(classId
        ? { classId }
        : learnerClassIds.length === 1
          ? { classId: learnerClassIds[0] }
          : { classId: { in: learnerClassIds } }),
      ...(learnerId ? { learnerId } : {}),
      ...(termId ? { termId } : {}),
    };

    const observations = await prisma.progressObservation.findMany({
      where,
      include: {
        subject: { select: { id: true, name: true, code: true } },
        class: { select: { id: true, name: true, gradeLevel: true } },
        term: { select: { id: true, name: true, termNumber: true } },
        academicYear: { select: { id: true, name: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ observations });
  })
);
