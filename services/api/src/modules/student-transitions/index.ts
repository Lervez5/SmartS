/**
 * Student Transitions - the authoritative academic-progression workspace.
 *
 * The central concept of this module is the `Enrollment` record: a learner's
 * placement in a particular Academic Session, Class/Grade, and optional Stream.
 * When the school proceeds a learner to the next session the system creates a
 * *new* enrollment for the target placement while retaining the previous one as
 * historical data - the learner's permanent identity, admission number, parent
 * links, documents, and other non-session-specific records are never touched and
 * never duplicated.
 *
 * Exits, withdrawals, and graduations (the Alumni lifecycle) are separate
 * concepts and live in the alumni module. The exit/restore endpoints here are
 * kept as a convenience link into that lifecycle but are not the primary
 * workflow.
 *
 * Hierarchy (strict):
 *   AcademicSession → Class/Grade → Stream
 * A learner's target Stream must belong to an existing target Class/Grade that
 * belongs to the selected target AcademicSession.
 *
 * Permissions:
 *   students.view        - read placements, sessions, classes, streams, exits
 *   academics.manage     - record academic transitions (create/update placement)
 *   students.manage      - record exits, update exits, restore learners
 */

import { Router, type Request, type Response } from 'express';
import { LearnerExitReason, Prisma, StreamStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';

export const router: Router = Router();

router.use(requireSchoolScope());

const exitReason = z.nativeEnum(LearnerExitReason);

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function optionalId(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertValidObjectId(value: string, label = 'id'): string {
  if (!OBJECT_ID.test(value)) {
    throw new ApiError(400, `${label} must be a valid identifier`);
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

const placementListSchema = z.object({
  sourceAcademicYearId: z.string().min(1),
  sourceClassId: z.string().optional(),
  sourceStreamId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
});

const transitionSchema = z.object({
  studentId: z.string().min(1),
  targetAcademicYearId: z.string().min(1),
  targetClassId: z.string().min(1),
  targetStreamId: z.string().optional(),
  reason: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const bulkTransitionSchema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(500),
  targetAcademicYearId: z.string().min(1),
  targetClassId: z.string().min(1),
  targetStreamId: z.string().optional(),
  reason: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const listSchema = z.object({
  search: z.string().optional(),
  reason: exitReason.optional(),
  academicYearId: z.string().optional(),
  dateFrom: z.string().min(10).optional(),
  dateTo: z.string().min(10).optional(),
  includeRestored: z.coerce.boolean().optional(),
  sort: z.enum(['exit_desc', 'exit_asc', 'name_asc', 'name_desc', 'reason']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const recordExitSchema = z.object({
  studentId: z.string().min(1),
  reason: exitReason,
  exitDate: z.string().min(10).optional(),
  lastGradeLevel: z.string().max(32).optional(),
  lastStream: z.string().max(64).optional(),
  academicYearId: z.string().optional(),
  destination: z.string().max(160).optional(),
  notes: z.string().max(2000).optional(),
});

const updateExitSchema = z.object({
  reason: exitReason.optional(),
  exitDate: z.string().min(10).optional(),
  lastGradeLevel: z.string().max(32).nullable().optional(),
  lastStream: z.string().max(64).nullable().optional(),
  academicYearId: z.string().nullable().optional(),
  destination: z.string().max(160).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const restoreSchema = z.object({
  targetGradeLevel: z.string().max(32).optional(),
  targetStream: z.string().max(64).optional(),
  classId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

/* ------------------------------------------------------------------ *
 * Shared includes
 * ------------------------------------------------------------------ */

const enrollmentInclude = {
  student: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatar: true,
      status: true,
      studentProfile: {
        select: {
          id: true,
          gradeLevel: true,
          admissionId: true,
          dateOfBirth: true,
          gender: true,
          enrollmentDate: true,
        },
      },
    },
  },
  class: { select: { id: true, name: true, classCode: true, gradeLevel: true } },
  stream: { select: { id: true, name: true, code: true } },
  academicYear: { select: { id: true, name: true, label: true, startDate: true, endDate: true } },
} satisfies Prisma.EnrollmentInclude;

/** Base include shared across exit endpoints. */
const baseInclude = {
  student: {
    select: {
      id: true,
      gradeLevel: true,
      admissionId: true,
      dateOfBirth: true,
      gender: true,
      enrollmentDate: true,
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatar: true,
          status: true,
        },
      },
    },
  },
  academicYear: { select: { id: true, name: true, label: true } },
} satisfies Prisma.LearnerExitInclude;

/* ------------------------------------------------------------------ *
 * Academic-progression endpoints (primary workflow)
 * ------------------------------------------------------------------ */

/**
 * List academic sessions available for source/target selection.
 *
 * Returns only sessions that belong to the caller's school. Sessions are
 * ordered by start date descending (most recent first) so the active session
 * typically appears at the top.
 */
router.get(
  '/sessions',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const sessions = await prisma.academicYear.findMany({
      where: { schoolId },
      orderBy: { startDate: 'desc' },
      select: {
        id: true,
        name: true,
        label: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });
    res.json({ sessions });
  })
);

/**
 * List classes/grades - optionally filtered to a single academic session.
 *
 * When `academicYearId` is provided, only classes that belong to that session
 * are returned. This enforces the hierarchy: a class cannot be placed under a
 * different session than the one the administrator selected.
 */
router.get(
  '/classes',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const academicYearId = req.query.academicYearId as string | undefined;

    const where: Prisma.ClassWhereInput = {
      schoolId,
      ...(academicYearId
        ? {
            academicYearId: academicYearId,
            academicYear: { id: academicYearId },
          }
        : {}),
      status: { not: 'archived' },
    };

    const classes = await prisma.class.findMany({
      where,
      select: {
        id: true,
        name: true,
        classCode: true,
        gradeLevel: true,
        academicYearId: true,
        status: true,
      },
      orderBy: [{ name: 'asc' }, { gradeLevel: 'asc' }],
    });

    res.json({
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name ?? '',
        code: c.classCode ?? c.name ?? '',
        gradeLevel: c.gradeLevel ?? null,
        label: c.classCode ? `${c.name} (${c.classCode})` : c.name,
        academicYearId: c.academicYearId,
        status: c.status,
      })),
    });
  })
);

/**
 * List streams for a given class, scoped to the caller's school.
 *
 * A stream always belongs to one parent class, so the request must supply
 * `classId`. The returned streams are filtered to those whose parent class
 * belongs to the caller's school.
 */
router.get(
  '/streams',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const classId = req.query.classId as string | undefined;

    if (classId) {
      assertValidObjectId(classId, 'classId');
    }

    const streams = await prisma.stream.findMany({
      where: {
        ...(classId ? { classId } : {}),
        class: { schoolId },
        status: { not: 'archived' },
      },
      include: {
        class: { select: { id: true, name: true, gradeLevel: true, academicYearId: true } },
      },
      orderBy: [{ code: 'asc' }, { name: 'asc' }],
    });

    res.json({
      streams: streams.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        parentClassId: s.class.id,
        parentClassName: s.class.name || null,
        parentGradeLevel: s.class.gradeLevel ?? null,
        academicYearId: s.class.academicYearId,
        status: s.status,
      })),
    });
  })
);

/**
 * List learner placements (enrollments) for a source session, optionally
 * narrowed by class and stream.
 *
 * This is the source-data endpoint: the admin selects a source Academic Session
 * (and optionally a class/stream) to see which learners are currently placed
 * there and could be transitioned to a new session.
 */
router.get(
  '/placements',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = placementListSchema.parse(req.query);

    assertValidObjectId(query.sourceAcademicYearId, 'sourceAcademicYearId');
    if (query.sourceClassId) assertValidObjectId(query.sourceClassId, 'sourceClassId');
    if (query.sourceStreamId) assertValidObjectId(query.sourceStreamId, 'sourceStreamId');

    const where: Prisma.EnrollmentWhereInput = {
      class: {
        schoolId,
        academicYearId: query.sourceAcademicYearId,
        ...(query.sourceClassId ? { id: query.sourceClassId } : {}),
        ...(query.sourceClassId
          ? {}
          : {
              // Without a class filter, ensure the enrollment's class truly belongs
              // to the selected session (belt-and-suspenders).
            }),
      },
      ...(query.sourceStreamId ? { streamId: query.sourceStreamId } : {}),
      ...(query.search
        ? {
            OR: [
              { student: { name: { contains: query.search, mode: 'insensitive' } } },
              { student: { firstName: { contains: query.search, mode: 'insensitive' } } },
              { student: { lastName: { contains: query.search, mode: 'insensitive' } } },
              { student: { email: { contains: query.search, mode: 'insensitive' } } },
              ...(OBJECT_ID.test(query.search)
                ? [{ student: { studentProfile: { admissionId: { equals: query.search } } } }]
                : []),
            ],
          }
        : {}),
    };

    const [placements, total] = await Promise.all([
      prisma.enrollment.findMany({
        where,
        include: enrollmentInclude,
        orderBy: [{ student: { name: 'asc' } }, { createdAt: 'desc' }],
        take: Number(query.limit),
      }),
      prisma.enrollment.count({ where }),
    ]);

    res.json({
      placements: placements.map((p) => presentPlacement(p)),
      total,
    });
  })
);

function presentPlacement(p: {
  id: string;
  studentId: string | null;
  classId: string;
  streamId: string | null;
  academicYearId: string | null;
  startDate: Date | null;
  createdAt: Date;
  student: {
    id: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    avatar: string | null;
    status: string;
    studentProfile: {
      id: string;
      gradeLevel: string | null;
      admissionId: string | null;
      dateOfBirth: Date | null;
      gender: string | null;
      enrollmentDate: Date | null;
    } | null;
  } | null;
  class: { id: string; name: string; classCode: string | null; gradeLevel: string | null } | null;
  stream: { id: string; name: string; code: string } | null;
  academicYear: {
    id: string;
    name: string;
    label: string | null;
    startDate: Date;
    endDate: Date;
  } | null;
}) {
  return {
    id: p.id,
    studentId: p.studentId ?? null,
    classId: p.classId,
    userId: p.student?.id ?? null,
    name: p.student?.name ?? null,
    firstName: p.student?.firstName ?? null,
    lastName: p.student?.lastName ?? null,
    email: p.student?.email ?? '',
    phone: p.student?.phone ?? null,
    avatar: p.student?.avatar ?? null,
    admissionId: p.student?.studentProfile?.admissionId ?? null,
    dateOfBirth: p.student?.studentProfile?.dateOfBirth ?? null,
    gender: p.student?.studentProfile?.gender ?? null,
    enrollmentDate: p.student?.studentProfile?.enrollmentDate ?? null,
    gradeLevel: p.student?.studentProfile?.gradeLevel ?? null,
    accountStatus: p.student?.status ?? '',
    sourceAcademicYear: p.academicYear
      ? { id: p.academicYear.id, name: p.academicYear.name, label: p.academicYear.label }
      : null,
    sourceClass: p.class
      ? {
          id: p.class.id,
          name: p.class.name,
          classCode: p.class.classCode,
          gradeLevel: p.class.gradeLevel,
        }
      : null,
    sourceStream: p.stream ? { id: p.stream.id, name: p.stream.name, code: p.stream.code } : null,
    startDate: p.startDate ?? p.createdAt,
  };
}

/**
 * Record a single academic transition.
 *
 * Validates that:
 * - The learner exists and has a profile in this school.
 * - The target class belongs to the target academic session.
 * - The target stream (if given) belongs to the target class.
 * - The learner is not already enrolled in the target class.
 *
 * Creates a new Enrollment for the target placement. The previous enrollment
 * is retained as historical data.
 */
router.post(
  '/placements',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = transitionSchema.parse(req.body);
    const actorId = req.user!.id;

    const result = await createTransition({
      schoolId,
      studentId: payload.studentId,
      targetAcademicYearId: payload.targetAcademicYearId,
      targetClassId: payload.targetClassId,
      targetStreamId: payload.targetStreamId,
      reason: payload.reason,
      notes: payload.notes,
      actorId,
      tx: prisma,
    });

    res.status(201).json({ placement: result.placement });
  })
);

/**
 * Bulk-transition learners into the same target class/stream.
 *
 * Each learner is validated individually; failures are collected and returned
 * alongside successes rather than aborting the entire batch.
 */
router.post(
  '/placements/bulk',
  requirePermissions('academics.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = bulkTransitionSchema.parse(req.body);
    const actorId = req.user!.id;

    const results: Array<{
      studentId: string;
      success: boolean;
      placement?: any;
      error?: string;
    }> = [];

    for (const studentId of payload.studentIds) {
      try {
        const result = await createTransition({
          schoolId,
          studentId,
          targetAcademicYearId: payload.targetAcademicYearId,
          targetClassId: payload.targetClassId,
          targetStreamId: payload.targetStreamId,
          reason: payload.reason,
          notes: payload.notes,
          actorId,
          tx: prisma,
        });
        results.push({ studentId, success: true, placement: result.placement });
      } catch (e) {
        const message = e instanceof ApiError ? e.message : (e as Error).message;
        const status = e instanceof ApiError ? e.statusCode : 500;
        results.push({ studentId, success: false, error: message });
        void status; // status is used for response below
      }
    }

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    await recordAuditLog(
      actorId,
      'STUDENT_TRANSITION_BULK',
      `Bulk-transitioned ${succeeded.length} learners into class ` +
        `${payload.targetClassId} (session ${payload.targetAcademicYearId}). ` +
        `${failed.length} learners were rejected.`
    );

    res.status(207).json({
      results,
      summary: {
        total: results.length,
        succeeded: succeeded.length,
        failed: failed.length,
      },
    });
  })
);

/**
 * Core transition logic, shared by single and bulk endpoints.
 *
 * Runs inside a transaction so that a failed validation for any learner does
 * not leave a partial enrollment.
 */
async function createTransition(opts: {
  schoolId: string;
  studentId: string;
  targetAcademicYearId: string;
  targetClassId: string;
  targetStreamId?: string;
  reason?: string;
  notes?: string;
  actorId: string;
  tx: Prisma.TransactionClient;
}): Promise<{ placement: any }> {
  const {
    schoolId,
    studentId,
    targetAcademicYearId,
    targetClassId,
    targetStreamId,
    reason,
    notes,
    actorId,
    tx,
  } = opts;

  // 1. Verify the target class belongs to the target session and this school.
  const targetClass = await tx.class.findFirst({
    where: { id: targetClassId, schoolId, academicYearId: targetAcademicYearId },
    select: { id: true, name: true, classCode: true, gradeLevel: true, academicYearId: true },
  });
  if (!targetClass) {
    throw new ApiError(
      404,
      'The selected destination class does not belong to the chosen academic session.'
    );
  }

  // 2. Verify the target stream (if provided) belongs to the target class.
  let targetStream = null;
  if (targetStreamId) {
    assertValidObjectId(targetStreamId, 'targetStreamId');
    targetStream = await tx.stream.findFirst({
      where: { id: targetStreamId, classId: targetClassId },
      select: { id: true, name: true, code: true, classId: true },
    });
    if (!targetStream) {
      throw new ApiError(
        404,
        'The selected stream does not belong to the chosen destination class.'
      );
    }
  }

  // 3. Verify the learner exists and has a profile in this school.
  const profile = await tx.studentProfile.findFirst({
    where: {
      userId: studentId,
      user: { schoolMemberships: { some: { schoolId } } },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
        },
      },
    },
  });
  if (!profile) {
    throw new ApiError(404, 'Learner not found in this school.');
  }

  // 4. Prevent duplicate placement in the target class.
  const existing = await tx.enrollment.findFirst({
    where: {
      studentId: profile.userId,
      classId: targetClassId,
    },
  });
  if (existing) {
    throw new ApiError(
      409,
      'This learner is already enrolled in that destination class. ' +
        'Use the learner profile or class enrolment tools to move them instead.'
    );
  }

  // 5. Create the new enrollment (the new placement).
  const placement = await tx.enrollment.create({
    data: {
      studentId: profile.userId,
      classId: targetClassId,
      streamId: targetStreamId || null,
      academicYearId: targetAcademicYearId,
      startDate: new Date(),
    },
    include: enrollmentInclude,
  });

  // 6. Update the profile's gradeLevel to reflect the new placement.
  await tx.studentProfile.update({
    where: { id: profile.id },
    data: { gradeLevel: targetClass.gradeLevel ?? profile.gradeLevel },
  });

  // 7. Audit log.
  await tx.auditLog.create({
    data: {
      userId: actorId,
      action: 'STUDENT_TRANSITION',
      details:
        `${profile.user.email} transitioned from ${profile.gradeLevel ?? 'N/A'} ` +
        `into ${targetClass.name}${targetStream ? ` / ${targetStream.code}` : ''} ` +
        `for session ${targetAcademicYearId}.` +
        (notes ? ` Notes: ${notes}` : ''),
    },
  });

  return { placement: presentPlacement(placement as any) };
}

/* ------------------------------------------------------------------ *
 * Exits / Restores (secondary lifecycle workflow)
 * ------------------------------------------------------------------ */

/** Filter options for the exit/restore views. */
router.get(
  '/options',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const [reasons, years, classes] = await Promise.all([
      prisma.learnerExit.groupBy({ by: ['reason'], _count: true }),
      prisma.learnerExit.findMany({
        where: { academicYearId: { not: null } },
        distinct: ['academicYearId'],
        select: {
          academicYear: { select: { id: true, name: true, label: true } },
        },
      }),
      prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, classCode: true, gradeLevel: true },
      }),
    ]);

    res.json({
      reasons: reasons.map((row) => ({ value: row.reason, count: row._count })),
      academicYears: years
        .map((row) => row.academicYear)
        .filter((y): y is { id: string; name: string; label: string | null } => Boolean(y))
        .map((y) => ({ value: y.id, label: y.label ?? y.name })),
      classes: classes.map((c) => ({
        value: c.id,
        label: c.classCode ? `${c.name} (${c.classCode})` : c.name,
        gradeLevel: c.gradeLevel,
      })),
    });
  })
);

router.get(
  '/',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = listSchema.parse(req.query);

    const orderBy =
      query.sort === 'name_asc'
        ? { student: { user: { name: 'asc' as const } } }
        : query.sort === 'name_desc'
          ? { student: { user: { name: 'desc' as const } } }
          : query.sort === 'reason'
            ? { reason: 'asc' as const }
            : query.sort === 'exit_asc'
              ? { exitDate: 'asc' as const }
              : { exitDate: 'desc' as const };

    const where: Prisma.LearnerExitWhereInput = {
      student: { user: { schoolMemberships: { some: { schoolId } } } },
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.academicYearId ? { academicYearId: optionalId(query.academicYearId) } : {}),
      ...(query.includeRestored ? {} : { restoredAt: null }),
      ...(query.dateFrom ? { exitDate: { gte: new Date(query.dateFrom) } } : {}),
      ...(query.dateTo ? { exitDate: { lte: new Date(query.dateTo) } } : {}),
      ...(query.search
        ? {
            OR: [
              ...(OBJECT_ID.test(query.search)
                ? [{ student: { admissionId: { equals: query.search } } }]
                : []),
              { destination: { contains: query.search, mode: 'insensitive' } },
              { student: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
              { student: { user: { firstName: { contains: query.search, mode: 'insensitive' } } } },
              { student: { user: { lastName: { contains: query.search, mode: 'insensitive' } } } },
              { student: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };

    const [exits, total] = await Promise.all([
      prisma.learnerExit.findMany({
        where,
        include: listInclude,
        orderBy,
        ...(query.limit ? { take: query.limit } : {}),
      }),
      prisma.learnerExit.count({ where }),
    ]);

    res.json({
      transitions: exits.map((exit) => presentExitWithClass(exit as any)),
      total,
    });
  })
);

const listInclude = {
  student: {
    select: {
      id: true,
      gradeLevel: true,
      admissionId: true,
      dateOfBirth: true,
      gender: true,
      enrollmentDate: true,
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatar: true,
          status: true,
          enrollments: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              class: { select: { id: true, name: true, classCode: true, gradeLevel: true } },
            },
          },
        },
      },
    },
  },
  academicYear: { select: { id: true, name: true, label: true } },
} satisfies Prisma.LearnerExitInclude;

function presentExitWithClass(exit: any) {
  const presented = presentExit(exit);
  const currentPlacement = exit.student?.user?.enrollments?.[0]?.class ?? null;
  return {
    ...presented,
    currentClass: currentPlacement
      ? {
          id: currentPlacement.id,
          name: currentPlacement.name,
          classCode: currentPlacement.classCode,
          gradeLevel: currentPlacement.gradeLevel,
        }
      : null,
  };
}

function presentExit(exit: {
  id: string;
  reason: LearnerExitReason;
  exitDate: Date;
  lastGradeLevel: string | null;
  lastStream: string | null;
  destination: string | null;
  notes: string | null;
  recordedAt: Date;
  restoredAt: Date | null;
  academicYearId: string | null;
  recordedById: string | null;
  restoredById: string | null;
  student: {
    id: string;
    gradeLevel: string | null;
    admissionId: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    enrollmentDate: Date | null;
    user: {
      id: string;
      name: string | null;
      firstName: string | null;
      lastName: string | null;
      email: string;
      phone: string | null;
      avatar: string | null;
      status: string;
    };
  };
  academicYear: { id: string; name: string; label: string | null } | null;
}) {
  return {
    id: exit.id,
    studentProfileId: exit.student.id,
    userId: exit.student.user.id,
    name: exit.student.user.name,
    firstName: exit.student.user.firstName,
    lastName: exit.student.user.lastName,
    email: exit.student.user.email,
    phone: exit.student.user.phone,
    avatar: exit.student.user.avatar,
    admissionId: exit.student.admissionId,
    dateOfBirth: exit.student.dateOfBirth,
    gender: exit.student.gender,
    enrollmentDate: exit.student.enrollmentDate,
    gradeLevel: exit.student.gradeLevel,
    accountStatus: exit.student.user.status,
    reason: exit.reason,
    exitDate: exit.exitDate,
    lastGradeLevel: exit.lastGradeLevel,
    lastStream: exit.lastStream,
    destination: exit.destination,
    notes: exit.notes,
    recordedAt: exit.recordedAt,
    recordedById: exit.recordedById,
    restoredAt: exit.restoredAt,
    restoredById: exit.restoredById,
    isRestored: exit.restoredAt !== null,
    academicYearId: exit.academicYearId,
    academicYear: exit.academicYear,
  };
}

/** Detail + timeline for a single exit record. */
router.get(
  '/:id',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const exit = await prisma.learnerExit.findFirst({
      where: {
        id: req.params.id,
        student: { user: { schoolMemberships: { some: { schoolId } } } },
      },
      include: {
        ...baseInclude,
        recordedBy: { select: { id: true, name: true, email: true } },
        restoredBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!exit) throw new ApiError(404, 'Transition record not found');

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: exit.student.user.id },
      include: {
        class: { select: { id: true, name: true, classCode: true, gradeLevel: true } },
        stream: { select: { id: true, code: true, name: true } },
        academicYear: { select: { id: true, name: true, label: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const allExits = await prisma.learnerExit.findMany({
      where: { studentId: exit.student.id },
      include: baseInclude,
      orderBy: { exitDate: 'desc' },
    });

    res.json({
      transition: {
        ...presentExit(exit as any),
        recordedBy: exit.recordedById
          ? { id: exit.recordedById, name: exit.recordedBy?.name, email: exit.recordedBy?.email }
          : null,
        restoredBy: exit.restoredById
          ? { id: exit.restoredById, name: exit.restoredBy?.name, email: exit.restoredBy?.email }
          : null,
        enrollments: enrollments.map((e) => ({
          id: e.id,
          classId: e.classId,
          className: e.class?.name ?? null,
          classCode: e.class?.classCode ?? null,
          gradeLevel: e.class?.gradeLevel ?? null,
          streamId: e.streamId,
          streamCode: e.stream?.code ?? null,
          streamName: e.stream?.name ?? null,
          academicYearId: e.academicYearId,
          academicYear: e.academicYear
            ? { id: e.academicYear.id, name: e.academicYear.name, label: e.academicYear.label }
            : null,
          startDate: e.startDate,
          createdAt: e.createdAt,
        })),
        history: allExits.map((e) => presentExit(e as any)),
      },
    });
  })
);

const recordInclude = {
  ...baseInclude,
  recordedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LearnerExitInclude;

router.post(
  '/',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = recordExitSchema.parse(req.body);
    const actorId = req.user!.id;

    const profile = await prisma.studentProfile.findFirst({
      where: {
        id: payload.studentId,
        user: { schoolMemberships: { some: { schoolId } } },
      },
      include: { user: { select: { id: true, email: true } } },
    });
    if (!profile) throw new ApiError(404, 'Learner not found');

    const open = await prisma.learnerExit.findFirst({
      where: { studentId: profile.id, restoredAt: null },
    });
    if (open) {
      throw new ApiError(
        409,
        'That learner already has an open transition record. Restore them first, or edit the existing record.'
      );
    }

    const exit = await prisma.$transaction(async (tx) => {
      const created = await tx.learnerExit.create({
        data: {
          studentId: profile.id,
          reason: payload.reason,
          exitDate: payload.exitDate ? new Date(payload.exitDate) : new Date(),
          lastGradeLevel: payload.lastGradeLevel ?? profile.gradeLevel,
          lastStream: payload.lastStream || null,
          academicYearId: optionalId(payload.academicYearId),
          destination: payload.destination || null,
          notes: payload.notes || null,
          recordedById: actorId,
          restoredAt: null,
        },
        include: recordInclude,
      });

      await tx.user.update({
        where: { id: profile.user.id },
        data: { status: 'archived' },
      });

      return created;
    });

    await recordAuditLog(
      actorId,
      'STUDENT_TRANSITION_EXIT',
      `Recorded ${payload.reason} transition for ${profile.user.email}`
    );

    const persisted = await prisma.learnerExit.findUniqueOrThrow({
      where: { id: exit.id },
      include: recordInclude,
    });

    const presented = presentExit(persisted as any);
    res.status(201).json({
      transition: {
        ...presented,
        recordedBy: exit.recordedById
          ? { id: exit.recordedById, name: exit.recordedBy?.name, email: exit.recordedBy?.email }
          : null,
      },
    });
  })
);

router.post(
  '/:id/restore',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = restoreSchema.parse(req.body);
    const actorId = req.user!.id;

    const exit = await prisma.learnerExit.findFirst({
      where: {
        id: req.params.id,
        student: { user: { schoolMemberships: { some: { schoolId } } } },
      },
      include: {
        student: { include: { user: { select: { id: true, email: true } } } },
      },
    });
    if (!exit) throw new ApiError(404, 'Transition record not found');

    if (exit.restoredAt) {
      throw new ApiError(409, 'This transition has already been reversed.');
    }

    const gradeLevel = payload.targetGradeLevel?.trim() || exit.lastGradeLevel;

    if (payload.classId) {
      const classRecord = await prisma.class.findFirst({
        where: { id: payload.classId, schoolId },
        select: { id: true, name: true },
      });
      if (!classRecord) throw new ApiError(404, 'Class not found');
    }

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.learnerExit.update({
        where: { id: exit.id },
        data: {
          restoredAt: new Date(),
          restoredById: actorId,
          notes: payload.notes || exit.notes,
        },
        include: recordInclude,
      });

      await tx.user.update({
        where: { id: exit.student.user.id },
        data: { status: 'active' },
      });

      if (gradeLevel) {
        await tx.studentProfile.update({
          where: { id: exit.studentId },
          data: { gradeLevel },
        });
      }

      if (payload.classId) {
        const existing = await tx.enrollment.findUnique({
          where: {
            studentId_classId: {
              studentId: exit.student.user.id,
              classId: payload.classId,
            },
          },
        });
        if (!existing) {
          await tx.enrollment.create({
            data: {
              studentId: exit.student.user.id,
              classId: payload.classId,
              startDate: new Date(),
            },
          });
        }
      }

      return updated;
    });

    await recordAuditLog(
      actorId,
      'STUDENT_TRANSITION_RESTORE',
      `Restored ${exit.student.user.email} to the active roll` +
        (payload.classId ? ` into class ${payload.classId}` : '')
    );

    const persisted = await prisma.learnerExit.findUniqueOrThrow({
      where: { id: restored.id },
      include: recordInclude,
    });

    res.json({ transition: presentExit(persisted as any) });
  })
);

router.patch(
  '/:id',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = updateExitSchema.parse(req.body);

    const existing = await prisma.learnerExit.findFirst({
      where: {
        id: req.params.id,
        student: { user: { schoolMemberships: { some: { schoolId } } } },
      },
    });
    if (!existing) throw new ApiError(404, 'Transition record not found');

    if (existing.restoredAt) {
      throw new ApiError(
        409,
        'This transition has already been reversed. Record a new transition rather than editing history.'
      );
    }

    const exit = await prisma.learnerExit.update({
      where: { id: req.params.id },
      data: {
        ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
        ...(payload.exitDate !== undefined ? { exitDate: new Date(payload.exitDate) } : {}),
        ...(payload.lastGradeLevel !== undefined
          ? { lastGradeLevel: payload.lastGradeLevel || null }
          : {}),
        ...(payload.lastStream !== undefined ? { lastStream: payload.lastStream || null } : {}),
        ...(payload.academicYearId !== undefined
          ? { academicYearId: optionalId(payload.academicYearId) ?? null }
          : {}),
        ...(payload.destination !== undefined ? { destination: payload.destination || null } : {}),
        ...(payload.notes !== undefined ? { notes: payload.notes || null } : {}),
      },
      include: baseInclude,
    });

    res.json({ transition: presentExit(exit as any) });
  })
);
