/**
 * Student Transitions - the academic lifecycle of a learner.
 *
 * This is the academic-facing companion to the Alumni Office. Where Alumni
 * records *that a learner left*, Student Transitions shows *how* they moved
 * through the school: every class placement, the session it happened in, the
 * exit, and any restore - all as a single timeline.
 *
 * The `Enrollment` model now carries `academicYearId` so each class placement
 * can be attributed to the session the learner joined it in. That is the one
 * schema change this module requires; the rest reads existing models
 * (LearnerExit, StudentProfile, Enrollment, Class, AcademicYear).
 *
 * Write operations reuse `students.manage` (the permission the Academics nav
 * entry is gated on) rather than `alumni.manage`, so a DEAN - who holds
 * students.manage but not alumni.manage - can record exits and restores from
 * this view.
 */

import { Router, type Request, type Response } from 'express';
import { LearnerExitReason, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';

export const router: Router = Router();

const exitReason = z.nativeEnum(LearnerExitReason);

function optionalId(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

const listSchema = z.object({
  search: z.string().optional(),
  reason: exitReason.optional(),
  academicYearId: z.string().optional(),
  dateFrom: z.string().min(10).optional(),
  dateTo: z.string().min(10).optional(),
  includeRestored: z.coerce.boolean().optional(),
  sort: z
    .enum(['exit_desc', 'exit_asc', 'name_asc', 'name_desc', 'reason'])
    .optional(),
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

/** Base include shared across all endpoints. */
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

/** Extended include for the list endpoint: pulls the learner's current class. */
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

/* ------------------------------------------------------------------ *
 * List + options
 * ------------------------------------------------------------------ */

router.get(
  '/',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
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
      transitions: exits.map((exit) => {
        const presented = presentExit(exit as any);
        const currentPlacement = (exit as any).student?.user?.enrollments?.[0]?.class ?? null;
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
      }),
      total,
    });
  })
);

/** Filter options, derived from exits that actually exist. */
router.get(
  '/options',
  requirePermissions('students.view'),
  asyncHandler(async (_req: Request, res: Response) => {
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

/* ------------------------------------------------------------------ *
 * Detail + timeline
 * ------------------------------------------------------------------ */

router.get(
  '/:id',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const exit = await prisma.learnerExit.findUnique({
      where: { id: req.params.id },
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

/* ------------------------------------------------------------------ *
 * Record exit
 * ------------------------------------------------------------------ */

const recordInclude = {
  ...baseInclude,
  recordedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LearnerExitInclude;

router.post(
  '/',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = recordExitSchema.parse(req.body);
    const actorId = req.user!.id;

    const profile = await prisma.studentProfile.findUnique({
      where: { id: payload.studentId },
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

/* ------------------------------------------------------------------ */

/**
 * Restore a learner to the active roll.
 *
 * Mirrors the alumni module's restore, but is gated on `students.manage` so that
 * a DEAN can manage transitions from the Academics section without needing
 * `alumni.manage`.
 */
router.post(
  '/:id/restore',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = restoreSchema.parse(req.body);
    const actorId = req.user!.id;

    const exit = await prisma.learnerExit.findUnique({
      where: { id: req.params.id },
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
      const classRecord = await prisma.class.findUnique({
        where: { id: payload.classId },
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

/* ------------------------------------------------------------------ *
 * Update a transition (edit exit details)
 * ------------------------------------------------------------------ */

router.patch(
  '/:id',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateExitSchema.parse(req.body);
    const existing = await prisma.learnerExit.findUnique({ where: { id: req.params.id } });
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
