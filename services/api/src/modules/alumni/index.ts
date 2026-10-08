/**
 * Alumni Office — learners who have left the school.
 *
 * An exit is recorded against the existing StudentProfile rather than in a
 * separate alumni entity, so the former learner keeps one identity: their
 * attendance, grades, exam attempts, documents, invoices and parent links stay
 * attached to the record this screen reads. Restoring re-enrols that same
 * learner; it never creates a second identity or a second admission.
 *
 * A restore stamps `restoredAt` instead of deleting the row, so both the exit
 * and its reversal remain auditable, and the audit log records who did what.
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

/**
 * Treats an empty string as absent.
 *
 * A cleared form field submits `""`, and every optional id in this module points
 * at an ObjectId column, which Prisma rejects as malformed. Left alone, clearing
 * the "Academic session" field turned an ordinary save into a 500.
 */
function optionalId(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/** Whether a term is shaped like a Mongo ObjectId. */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

const listSchema = z.object({
  search: z.string().optional(),
  /** Only unresolved exits are listed by default. */
  includeRestored: z.coerce.boolean().optional(),
  reason: exitReason.optional(),
  academicYearId: z.string().optional(),
  sort: z.enum(['exit_desc', 'exit_asc', 'name_asc', 'name_desc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const recordExitSchema = z
  .object({
    /** StudentProfile id, not the User id. */
    studentId: z.string().min(1),
    reason: exitReason,
    exitDate: z.string().min(10).optional(),
    lastGradeLevel: z.string().max(32).optional(),
    lastStream: z.string().max(64).optional(),
    academicYearId: z.string().optional(),
    destination: z.string().max(160).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((value) => !value.exitDate || value.reason === undefined, {
    message: 'Invalid exit date',
    path: ['exitDate'],
  })
  .refine((value) => value.reason !== 'transferred' || Boolean(value.destination), {
    message: 'A transfer needs the destination school',
    path: ['destination'],
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
  /** Optional grade the learner returns into; defaults to their last level. */
  targetGradeLevel: z.string().max(32).optional(),
  targetStream: z.string().max(64).optional(),
  /** Confirms the learner is re-enrolled into an existing class. */
  classId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const exitInclude = {
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

function present(exit: {
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
    reason: exit.reason,
    exitDate: exit.exitDate,
    lastGradeLevel: exit.lastGradeLevel,
    lastStream: exit.lastStream,
    destination: exit.destination,
    notes: exit.notes,
    recordedAt: exit.recordedAt,
    restoredAt: exit.restoredAt,
    academicYearId: exit.academicYearId,
    academicYear: exit.academicYear,
    // Identity lives on the student profile's user, unchanged by the exit.
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
    // Account state, deliberately separate from `reason`: an archived account
    // says the identity is closed, the reason says why they left.
    accountStatus: exit.student.user.status,
    isRestored: exit.restoredAt !== null,
  };
}

router.get(
  '/',
  requirePermissions('alumni.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const orderBy = {
      exit_desc: { exitDate: 'desc' as const },
      exit_asc: { exitDate: 'asc' as const },
      name_asc: { student: { user: { name: 'asc' as const } } },
      name_desc: { student: { user: { name: 'desc' as const } } },
    }[query.sort ?? 'exit_desc'];

    // One clause feeds both the rows and the count. Building them separately is
    // how the header came to report an unfiltered total while the table showed a
    // filtered one — `?search=zzz` reported 1 over an empty table.
    const where: Prisma.LearnerExitWhereInput = {
      ...(query.reason ? { reason: query.reason } : {}),
      ...(query.academicYearId ? { academicYearId: optionalId(query.academicYearId) } : {}),
      ...(query.includeRestored ? {} : { restoredAt: null }),
      ...(query.search
        ? {
            OR: [
              // `admissionId` is an ObjectId column, so Prisma validates the
              // filter value as a hex id before the query runs. Branching on it
              // unconditionally made every ordinary search throw.
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
        include: exitInclude,
        orderBy,
        ...(query.limit ? { take: query.limit } : {}),
      }),
      prisma.learnerExit.count({ where }),
    ]);

    res.json({ alumni: exits.map(present), total });
  })
);

/** Filter options, derived from exits that actually exist. */
router.get(
  '/options',
  requirePermissions('alumni.view'),
  asyncHandler(async (_req: Request, res: Response) => {
    const [reasons, years] = await Promise.all([
      prisma.learnerExit.groupBy({ by: ['reason'], _count: true }),
      prisma.learnerExit.findMany({
        where: { academicYearId: { not: null }, restoredAt: null },
        distinct: ['academicYearId'],
        select: { academicYear: { select: { id: true, name: true, label: true } } },
      }),
    ]);

    res.json({
      reasons: reasons.map((row) => ({
        value: row.reason,
        count: row._count,
      })),
      academicYears: years
        .map((row) => row.academicYear)
        .filter((y): y is { id: string; name: string; label: string | null } => Boolean(y))
        .map((y) => ({ value: y.id, label: y.label ?? y.name })),
    });
  })
);

router.get(
  '/:id',
  requirePermissions('alumni.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const exit = await prisma.learnerExit.findUnique({
      where: { id: req.params.id },
      include: exitInclude,
    });
    if (!exit) throw new ApiError(404, 'Alumni record not found');

    res.json({ alumni: present(exit) });
  })
);

/**
 * Record a learner leaving the school.
 *
 * Refuses a learner who already has an unresolved exit, so a second exit cannot
 * silently supersede the first. Archives the account alongside the record:
 * an exit with an active account would let a former learner keep signing in.
 */
router.post(
  '/',
  requirePermissions('alumni.manage'),
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
        'That learner already has an open exit record. Restore them first, or edit the existing record.'
      );
    }

    const exit = await prisma.$transaction(async (tx) => {
      const created = await tx.learnerExit.create({
        data: {
          studentId: profile.id,
          reason: payload.reason,
          exitDate: payload.exitDate ? new Date(payload.exitDate) : new Date(),
          // Defaults to the level the learner is actually on, so the archive
          // records what was true rather than what someone typed.
          lastGradeLevel: payload.lastGradeLevel ?? profile.gradeLevel,
          lastStream: payload.lastStream || null,
          academicYearId: optionalId(payload.academicYearId),
          destination: payload.destination || null,
          notes: payload.notes || null,
          recordedById: actorId,
          // Written explicitly rather than left to the default, so the
          // unresolved-exit filter can rely on the field existing.
          restoredAt: null,
        },
        include: exitInclude,
      });

      await tx.user.update({
        where: { id: profile.user.id },
        data: { status: 'archived' },
      });

      return created;
    });

    await recordAuditLog(
      actorId,
      'RECORD_LEARNER_EXIT',
      `Recorded ${payload.reason} exit for ${profile.user.email}`
    );

    // Re-read rather than reusing the create's include: that read the user row
    // before the same transaction archived it, so the response would have shown
    // the learner as still active.
    const persisted = await prisma.learnerExit.findUniqueOrThrow({
      where: { id: exit.id },
      include: exitInclude,
    });

    res.status(201).json({ alumni: present(persisted) });
  })
);

router.patch(
  '/:id',
  requirePermissions('alumni.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateExitSchema.parse(req.body);
    const existing = await prisma.learnerExit.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Alumni record not found');

    if (existing.restoredAt) {
      throw new ApiError(
        409,
        'This exit has already been reversed. Record a new exit rather than editing history.'
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
      include: exitInclude,
    });

    res.json({ alumni: present(exit) });
  })
);

/**
 * Restore a learner to the active roll.
 *
 * This is the sensitive operation the screen guards behind a confirmation, and
 * the work happens here rather than in the browser:
 *  - the exit is stamped restored, not deleted, so the archive keeps its history
 *  - the account is reactivated
 *  - class placement goes through Enrollment, the same path enrolment uses, so
 *    a restore cannot invent a second way for a learner to be in a class
 *  - the action is written to the audit log
 */
router.post(
  '/:id/restore',
  requirePermissions('alumni.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = restoreSchema.parse(req.body);
    const actorId = req.user!.id;

    const exit = await prisma.learnerExit.findUnique({
      where: { id: req.params.id },
      include: {
        student: { include: { user: { select: { id: true, email: true } } } },
      },
    });
    if (!exit) throw new ApiError(404, 'Alumni record not found');

    if (exit.restoredAt) {
      throw new ApiError(409, 'This learner has already been restored.');
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
        include: exitInclude,
      });

      await tx.user.update({
        where: { id: exit.student.user.id },
        data: { status: 'active' },
      });

      // Grade placement follows the learner, not the exit record, because
      // StudentProfile.gradeLevel is what the rest of the platform reads.
      if (gradeLevel) {
        await tx.studentProfile.update({
          where: { id: exit.studentId },
          data: { gradeLevel },
        });
      }

      // Class placement goes through Enrollment, exactly as enrolment does.
      if (payload.classId) {
        const existing = await tx.enrollment.findUnique({
          where: {
            studentId_classId: { studentId: exit.student.user.id, classId: payload.classId },
          },
        });
        if (!existing) {
          await tx.enrollment.create({
            data: { studentId: exit.student.user.id, classId: payload.classId },
          });
        }
      }

      return updated;
    });

    await recordAuditLog(
      actorId,
      'RESTORE_LEARNER',
      `Restored ${exit.student.user.email} from the alumni roll` +
        (payload.classId ? ` into class ${payload.classId}` : '')
    );

    const persisted = await prisma.learnerExit.findUniqueOrThrow({
      where: { id: restored.id },
      include: exitInclude,
    });

    res.json({ alumni: present(persisted) });
  })
);
