/**
 * Enrollment Hub - the learner-entry workflow.
 *
 * This is the door a new learner comes through: an application is taken, the
 * school reviews it, and on acceptance the learner is placed into a class and
 * optional stream for an academic session. Placement is recorded as an
 * `Enrollment`, the same record academic progression (`student-transitions`)
 * writes when a learner moves between sessions - so a learner's first class and
 * every later one sit in one timeline with no second source of truth.
 *
 * Scope of this module, deliberately narrow:
 *   - application intake and review (AdmissionApplication has no routes yet)
 *   - the learner's *first* placement, including the learner account and
 *     profile it needs to exist at all
 *   - linking the learner to a parent/guardian at entry
 *
 * What it deliberately does not do:
 *   - it does not move an already-placed learner between sessions; that is
 *     `student-transitions`, and a learner already enrolled in the target class
 *     is rejected here rather than silently re-placed
 *   - it does not issue credentials; a created learner User is left `pending`
 *     and is activated through the normal invitation/activation path in auth
 *
 * Hierarchy (strict), enforced against the caller's school:
 *   School → AcademicSession → Class/Grade → Stream
 *
 * Permissions:
 *   admissions.view   - read applications and placements
 *   admissions.manage - take, review, withdraw and place applications
 *
 * Placement is gated on `admissions.manage` rather than `academics.manage`
 * because it is the entry workflow making its own placement decision, not
 * academic restructuring of a placed learner - a learner who is already placed
 * is moved by student-transitions, which keeps `academics.manage`.
 */

import { Router, type Request, type Response } from 'express';
import {
  AdmissionStatus,
  EnrollmentBatchStatus,
  EnrollmentEntryStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

export const router: Router = Router();

router.use(requireSchoolScope());

const requireEnrollmentView = requirePermissions('admissions.view');
const requireEnrollmentManage = requirePermissions('admissions.manage');

/** The one definition of the application lifecycle, reused for filtering. */
const admissionStatus = z.nativeEnum(AdmissionStatus);
/** Decisions a reviewer may record; `enrolled` is set by placement, not by review. */
const reviewableStatus = z.enum([
  AdmissionStatus.pending,
  AdmissionStatus.accepted,
  AdmissionStatus.rejected,
  AdmissionStatus.withdrawn,
]);

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

function assertObjectId(value: string, label = 'id'): string {
  if (!OBJECT_ID.test(value)) {
    throw new ApiError(400, `${label} must be a valid identifier`);
  }
  return value;
}

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

const listApplicationsSchema = z.object({
  status: admissionStatus.optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const createApplicationSchema = z
  .object({
    /** Existing learner to open an application for, when there is one. */
    userId: z.string().trim().min(1).optional(),
    /** Applicant details, used to create the learner account. */
    email: z.string().trim().email().optional(),
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().max(120).optional(),
    name: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(40).optional(),
    /** Profile fields the registrar collects at intake. */
    gradeLevel: z.string().trim().max(32).optional(),
    dateOfBirth: z.string().optional(),
    gender: z.enum(['male', 'female', 'other', 'unspecified']).optional(),
    /** Parent/guardian to link the learner to, if they already have an account. */
    parentUserId: z.string().trim().min(1).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .refine((value) => Boolean(value.userId) || Boolean(value.email), {
    message: 'Provide either an existing learner (userId) or an applicant email.',
    path: ['userId'],
  });

const reviewApplicationSchema = z.object({
  status: reviewableStatus,
  notes: z.string().trim().max(2000).optional(),
});

const bulkReviewSchema = z.object({
  applicationIds: z.array(z.string().trim().min(1)).min(1).max(500),
  status: z.enum([AdmissionStatus.accepted, AdmissionStatus.rejected, AdmissionStatus.withdrawn]),
  notes: z.string().trim().max(2000).optional(),
});

const enrollSchema = z.object({
  classId: z.string().trim().min(1),
  streamId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  parentUserId: z.string().trim().min(1).optional(),
});

const listPlacementsSchema = z.object({
  classId: z.string().trim().min(1).optional(),
  streamId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

/**
 * One person in a bulk enrollment run.
 *
 * Only `role` and `email` are required. Everything else is the attribute set
 * for the person's category - a learner needs a placement, staff need an
 * employee id and position - so an operator pasting a staff roster is not asked
 * for a class, and a learner roster is not asked for a department.
 */
const batchEntrySchema = z.object({
  role: z.nativeEnum(UserRole).default(UserRole.STUDENT),
  email: z.string().trim().email(),
  firstName: z.string().trim().min(1).max(120).optional(),
  lastName: z.string().trim().max(120).optional(),
  name: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  // Learner
  gradeLevel: z.string().trim().max(32).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'unspecified']).optional(),
  admissionNumber: z.string().trim().max(64).optional(),
  classId: z.string().trim().min(1).optional(),
  streamId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  parentEmail: z.string().trim().email().optional(),
  // Staff
  employeeId: z.string().trim().max(64).optional(),
  position: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  hireDate: z.string().optional(),
});

const createBatchSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  /** Where the rows came from, for the operator's recollection. */
  source: z.string().trim().max(120).optional(),
  entries: z.array(batchEntrySchema).min(1).max(500),
});

const listBatchesSchema = z.object({
  status: z.nativeEnum(EnrollmentBatchStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const listBatchEntriesSchema = z.object({
  status: z.nativeEnum(EnrollmentEntryStatus).optional(),
});

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

const applicationInclude = {
  applicant: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          phone: true,
          avatar: true,
        },
      },
      parentLinks: {
        include: {
          parent: {
            select: {
              id: true,
              userId: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.AdmissionApplicationInclude;

const placementInclude = {
  student: {
    select: {
      id: true,
      name: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      avatar: true,
    },
  },
  class: {
    select: {
      id: true,
      name: true,
      classCode: true,
      gradeLevel: true,
      schoolId: true,
    },
  },
  stream: { select: { id: true, name: true, code: true, status: true } },
  academicYear: { select: { id: true, name: true, label: true, status: true } },
} satisfies Prisma.EnrollmentInclude;

function displayName(user: {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return user.name?.trim() || full || 'Unnamed applicant';
}

function mapApplication(application: any) {
  const user = application.applicant?.user;
  return {
    id: application.id,
    status: application.status as AdmissionStatus,
    appliedAt: application.appliedAt,
    reviewedAt: application.reviewedAt,
    notes: application.notes,
    applicant: {
      studentProfileId: application.applicantId,
      userId: user?.id ?? null,
      name: user ? displayName(user) : 'Unknown applicant',
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      avatar: user?.avatar ?? null,
      accountStatus: user?.status ?? null,
      gradeLevel: application.applicant?.gradeLevel ?? null,
      dateOfBirth: application.applicant?.dateOfBirth ?? null,
      gender: application.applicant?.gender ?? null,
      parents: (application.applicant?.parentLinks ?? []).map((link: any) => ({
        id: link.parent?.id ?? link.parentId,
        userId: link.parent?.userId ?? null,
        name: link.parent?.user?.name ?? null,
        email: link.parent?.user?.email ?? null,
      })),
    },
  };
}

function mapPlacement(enrollment: any) {
  return {
    id: enrollment.id,
    startDate: enrollment.startDate,
    createdAt: enrollment.createdAt,
    student: enrollment.student
      ? {
          id: enrollment.student.id,
          name: displayName(enrollment.student),
          email: enrollment.student.email,
          accountStatus: enrollment.student.status,
          avatar: enrollment.student.avatar,
        }
      : null,
    class: enrollment.class,
    stream: enrollment.stream,
    academicYear: enrollment.academicYear,
  };
}

/* ------------------------------------------------------------------ *
 * Bulk onboarding - any category of person
 * ------------------------------------------------------------------ */

/**
 * Which profile a role gets.
 *
 * The role decides the shape of the person's record: a learner is placed in a
 * class, a guardian links to learners, and staff carry an employee record.
 * Every person is one User underneath, so a role added later does not mean
 * on-boarding them again.
 */
type ProfileKind = 'student' | 'parent' | 'staff';

function profileKindFor(role: UserRole): ProfileKind {
  if (role === UserRole.STUDENT) return 'student';
  if (role === UserRole.PARENT) return 'parent';
  return 'staff';
}

/**
 * Brings one person into the school, and returns what happened.
 *
 * Called inside a transaction the caller owns, so a batch rolls a row back on
 * failure without losing the rows that already succeeded. `duplicate` is a
 * successful outcome, not an error: the person is already in the school and
 * re-creating them would fork their record.
 */
async function onboardEntry(
  tx: Prisma.TransactionClient,
  schoolId: string,
  entry: z.infer<typeof batchEntrySchema>,
  rowNumber: number
): Promise<{
  status: EnrollmentEntryStatus;
  userId: string | null;
  error: string | null;
}> {
  const email = entry.email.trim().toLowerCase();

  // 1. Email is the identity key. An account that already exists is the same
  //    person, and creating a second one would split their attendance, results
  //    and finances across two identities.
  const existingUser = await tx.user.findUnique({ where: { email } });
  if (existingUser) {
    const membership = await tx.schoolMembership.findFirst({
      where: { userId: existingUser.id, schoolId },
    });
    return {
      status: EnrollmentEntryStatus.duplicate,
      userId: existingUser.id,
      error: membership
        ? null
        : 'That email belongs to an account in another school. Grant access from the other school.',
    };
  }

  const role = entry.role;
  const kind = profileKindFor(role);
  const personRole = await tx.role.findUnique({ where: { name: role } });

  // 2. The account. Left `pending`: activating it - setting a password, or
  //    sending an invitation - is the auth flow's job, and doing it here would
  //    put a credential into a bulk import.
  const user = await tx.user.create({
    data: {
      email,
      name:
        entry.name?.trim() || [entry.firstName, entry.lastName].filter(Boolean).join(' ') || null,
      firstName: entry.firstName?.trim() || null,
      lastName: entry.lastName?.trim() || null,
      phone: entry.phone?.trim() || null,
      status: 'pending',
      // The membership is what scopes them to this school. Without it no
      // school-scoped read would find them.
      schoolMemberships: { create: { schoolId, isDefault: true } },
      ...(personRole ? { roleMemberships: { create: { roleId: personRole.id } } } : {}),
    },
    select: { id: true },
  });

  // 3. The profile for that category.
  if (kind === 'student') {
    await tx.studentProfile.create({
      data: {
        userId: user.id,
        gradeLevel: entry.gradeLevel ?? null,
        admissionId: entry.admissionNumber ?? null,
        dateOfBirth: entry.dateOfBirth ? new Date(entry.dateOfBirth) : null,
        gender: entry.gender ?? null,
        enrollmentDate: new Date(),
      },
    });
  } else if (kind === 'parent') {
    await tx.parentProfile.create({ data: { userId: user.id } });
  } else {
    await tx.staffProfile.create({
      data: {
        userId: user.id,
        employeeId: entry.employeeId ?? null,
        position: entry.position ?? null,
        department: entry.department ?? null,
        hireDate: entry.hireDate ? new Date(entry.hireDate) : null,
      },
    });
  }

  // 4. A learner is placed only when the import says where. An unplaced learner
  //    is still on record - a class can be assigned afterwards.
  if (kind === 'student' && entry.classId) {
    const targetClass = await tx.class.findFirst({
      where: { id: entry.classId, schoolId },
      select: { id: true, name: true, gradeLevel: true },
    });
    if (!targetClass) {
      throw new ApiError(
        400,
        `Row ${rowNumber}: the selected class does not exist in your school.`
      );
    }

    let streamId: string | null = null;
    if (entry.streamId) {
      const stream = await tx.stream.findFirst({
        where: { id: entry.streamId, classId: targetClass.id },
        select: { id: true },
      });
      if (!stream) {
        throw new ApiError(
          400,
          `Row ${rowNumber}: that stream does not belong to the chosen class.`
        );
      }
      streamId = stream.id;
    }

    let academicYearId: string | null = null;
    if (entry.academicYearId) {
      const year = await tx.academicYear.findFirst({
        where: { id: entry.academicYearId, schoolId },
        select: { id: true },
      });
      if (!year) {
        throw new ApiError(400, `Row ${rowNumber}: that academic session is not your school's.`);
      }
      academicYearId = year.id;
    }

    const placed = await tx.enrollment.findFirst({
      where: { studentId: user.id, classId: targetClass.id },
      select: { id: true },
    });
    if (!placed) {
      await tx.enrollment.create({
        data: {
          studentId: user.id,
          classId: targetClass.id,
          streamId,
          academicYearId,
          startDate: new Date(),
        },
      });
    }

    // The grade level the import states and the one the class carries are the
    // same fact; the class wins, because it is what the learner is taught in.
    await tx.studentProfile.update({
      where: { userId: user.id },
      data: { gradeLevel: targetClass.gradeLevel ?? entry.gradeLevel ?? null },
    });

    // 5. A guardian is linked by email, because an operator pasting a roster has
    //    emails, not internal ids.
    if (entry.parentEmail) {
      const parent = await tx.parentProfile.findFirst({
        where: { user: { email: entry.parentEmail.trim().toLowerCase() } },
        select: { id: true },
      });
      if (parent) {
        const profile = await tx.studentProfile.findUniqueOrThrow({
          where: { userId: user.id },
          select: { id: true },
        });
        const linked = await tx.parentChildLink.findUnique({
          where: { parentId_childId: { parentId: parent.id, childId: profile.id } },
          select: { id: true },
        });
        if (!linked) {
          await tx.parentChildLink.create({
            data: { parentId: parent.id, childId: profile.id },
          });
        }
      }
    }
  }

  return { status: EnrollmentEntryStatus.enrolled, userId: user.id, error: null };
}

/** Counts a batch from its rows, so the stored counters cannot drift. */
function countBatch(entries: Array<{ status: EnrollmentEntryStatus }>): {
  enrolledCount: number;
  duplicateCount: number;
  failedCount: number;
} {
  return {
    enrolledCount: entries.filter((e) => e.status === EnrollmentEntryStatus.enrolled).length,
    duplicateCount: entries.filter((e) => e.status === EnrollmentEntryStatus.duplicate).length,
    failedCount: entries.filter((e) => e.status === EnrollmentEntryStatus.failed).length,
  };
}

const batchInclude = {
  entries: { orderBy: { rowNumber: 'asc' } },
} satisfies Prisma.EnrollmentBatchInclude;

function mapBatchEntry(entry: any) {
  return {
    id: entry.id,
    rowNumber: entry.rowNumber,
    role: entry.role as UserRole,
    profileKind: profileKindFor(entry.role as UserRole),
    status: entry.status as EnrollmentEntryStatus,
    email: entry.email,
    name: [entry.firstName, entry.lastName].filter(Boolean).join(' ') || entry.name || entry.email,
    phone: entry.phone,
    gradeLevel: entry.gradeLevel,
    dateOfBirth: entry.dateOfBirth,
    gender: entry.gender,
    admissionNumber: entry.admissionNumber,
    classId: entry.classId,
    streamId: entry.streamId,
    academicYearId: entry.academicYearId,
    parentEmail: entry.parentEmail,
    employeeId: entry.employeeId,
    position: entry.position,
    department: entry.department,
    hireDate: entry.hireDate,
    userId: entry.userId,
    error: entry.error,
  };
}

function mapBatch(batch: any) {
  const counts = countBatch(batch.entries ?? []);
  return {
    id: batch.id,
    schoolId: batch.schoolId,
    status: batch.status as EnrollmentBatchStatus,
    source: batch.source,
    notes: batch.notes,
    createdById: batch.createdById,
    createdAt: batch.createdAt,
    counts: {
      total: batch.totalRows ?? (batch.entries ?? []).length,
      ...counts,
      pending: (batch.entries ?? []).filter((e: any) => e.status === EnrollmentEntryStatus.pending)
        .length,
    },
    entries: (batch.entries ?? []).map(mapBatchEntry),
  };
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

/**
 * Hub overview: application counts by state plus the placement options the
 * reviewer needs, so the screen opens with everything it needs to act.
 */
router.get(
  '/',
  requireEnrollmentView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const [counts, classes, academicYears, recent] = await Promise.all([
      prisma.admissionApplication.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.class.findMany({
        where: { schoolId, status: 'active' },
        select: {
          id: true,
          name: true,
          classCode: true,
          gradeLevel: true,
          academicYearId: true,
          _count: { select: { enrollments: true } },
          streams: {
            where: { status: 'active' },
            select: { id: true, name: true, code: true, capacity: true, status: true },
            orderBy: { code: 'asc' },
          },
        },
        orderBy: [{ gradeLevel: 'asc' }, { name: 'asc' }],
      }),
      prisma.academicYear.findMany({
        where: { schoolId },
        select: { id: true, name: true, label: true, status: true, startDate: true, endDate: true },
        orderBy: { startDate: 'desc' },
      }),
      prisma.admissionApplication.findMany({
        take: 8,
        orderBy: { appliedAt: 'desc' },
        include: applicationInclude,
      }),
    ]);

    const byStatus = Object.values(AdmissionStatus).reduce<Record<string, number>>(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {}
    );

    for (const row of counts) {
      byStatus[row.status] = row._count._all;
    }

    res.json({
      summary: {
        total: Object.values(byStatus).reduce((sum: number, value: number) => sum + value, 0),
        byStatus,
        awaitingDecision: byStatus.pending,
      },
      classes,
      academicYears,
      recentApplications: recent.map(mapApplication),
    });
  })
);

/** Applications awaiting and completed review, newest first. */
router.get(
  '/applications',
  requireEnrollmentView,
  asyncHandler(async (req: Request, res: Response) => {
    const query = listApplicationsSchema.parse(req.query);

    const where: Prisma.AdmissionApplicationWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { applicant: { user: { name: { contains: query.search, mode: 'insensitive' } } } },
              {
                applicant: { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
              },
              {
                applicant: { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
              },
              { applicant: { user: { email: { contains: query.search, mode: 'insensitive' } } } },
              { notes: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const applications = await prisma.admissionApplication.findMany({
      where,
      take: query.limit,
      orderBy: { appliedAt: 'desc' },
      include: applicationInclude,
    });

    res.json({ applications: applications.map(mapApplication) });
  })
);

/**
 * Open an application for a learner.
 *
 * The applicant may be an existing learner in the school, or a brand-new one
 * described by email/name - in which case the User, its STUDENT role and the
 * StudentProfile are created here, because a learner who has never entered the
 * school has none of them. The account is left `pending`: activating it is the
 * invitation flow's job, not the front door's.
 */
router.post(
  '/applications',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = createApplicationSchema.parse(req.body);

    const application = await prisma.$transaction(async (tx) => {
      const providedUserId = payload.userId?.trim();
      const providedEmail = payload.email?.trim().toLowerCase();
      const intake = {
        gradeLevel: payload.gradeLevel,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        gender: payload.gender as never,
      };

      let applicantProfileId: string;

      if (providedUserId) {
        // An existing learner: they must belong to this school and already have a
        // profile, because a profile is what makes them a learner.
        const membership = await tx.schoolMembership.findFirst({
          where: { userId: providedUserId, schoolId },
        });
        if (!membership) {
          throw new ApiError(404, 'That learner does not belong to your school.');
        }

        const existingProfile = await tx.studentProfile.findUnique({
          where: { userId: providedUserId },
        });
        if (!existingProfile) {
          throw new ApiError(
            409,
            'That user has no learner profile yet. Create the learner profile before applying.'
          );
        }
        applicantProfileId = existingProfile.id;
      } else {
        const existingUser = await tx.user.findUnique({ where: { email: providedEmail! } });
        if (existingUser) {
          const existingProfile = await tx.studentProfile.findUnique({
            where: { userId: existingUser.id },
          });
          if (!existingProfile) {
            throw new ApiError(
              409,
              'An account with that email already exists but is not a learner. ' +
                'Open the application from the learner directory instead.'
            );
          }
          applicantProfileId = existingProfile.id;
        } else {
          // A brand-new learner: the User, its STUDENT grant, the profile that
          // makes them a learner and the school membership that scopes them all
          // appear together, since none of them exist yet. The account is left
          // `pending` - activation belongs to the invitation flow.
          const studentRole = await tx.role.findUnique({ where: { name: 'STUDENT' } });

          const profile = await tx.studentProfile.create({
            data: {
              ...intake,
              user: {
                create: {
                  email: providedEmail!,
                  name:
                    payload.name?.trim() ||
                    [payload.firstName, payload.lastName].filter(Boolean).join(' ') ||
                    null,
                  firstName: payload.firstName?.trim() || null,
                  lastName: payload.lastName?.trim() || null,
                  phone: payload.phone?.trim() || null,
                  status: 'pending',
                  // Without this membership the learner belongs to no school, so
                  // every school-scoped read and the placement itself would
                  // reject them. Entry is what puts them in the school.
                  schoolMemberships: { create: { schoolId, isDefault: true } },
                  ...(studentRole
                    ? { roleMemberships: { create: { roleId: studentRole.id } } }
                    : {}),
                },
              },
            },
            select: { id: true },
          });
          applicantProfileId = profile.id;
        }
      }

      const profile = await tx.studentProfile.findUniqueOrThrow({
        where: { id: applicantProfileId },
        select: { id: true },
      });

      // Profile details collected at intake are written here so the applicant is
      // reviewable without a second edit step, and the Placement route never has
      // to invent them.
      const profileData: Prisma.StudentProfileUpdateInput = {};
      if (payload.gradeLevel !== undefined) profileData.gradeLevel = payload.gradeLevel;
      if (payload.dateOfBirth !== undefined) {
        profileData.dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth) : null;
      }
      if (payload.gender !== undefined) profileData.gender = payload.gender;
      if (Object.keys(profileData).length > 0) {
        await tx.studentProfile.update({ where: { id: profile.id }, data: profileData });
      }

      // One open application per applicant: the status is reviewed in place, so
      // a second row would silently lose the first review.
      const openApplication = await tx.admissionApplication.findUnique({
        where: { applicantId: profile.id },
      });
      if (openApplication) {
        throw new ApiError(409, 'That learner already has an application. Review it instead.');
      }

      return tx.admissionApplication.create({
        data: {
          applicantId: profile.id,
          status: AdmissionStatus.pending,
          notes: payload.notes ?? null,
        },
        include: applicationInclude,
      });
    });

    res.status(201).json({ application: mapApplication(application) });
  })
);

/**
 * Review an application: accept, reject, send back to pending, or withdraw.
 *
 * Enrolling is a separate route because it needs a placement decision (class,
 * stream, session) that a review on its own does not carry.
 */
router.patch(
  '/applications/:id',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    const id = assertObjectId(req.params.id, 'application id');
    const payload = reviewApplicationSchema.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.admissionApplication.findUnique({ where: { id } });
      if (!existing) {
        throw new ApiError(404, 'Application not found.');
      }
      if (existing.status === AdmissionStatus.enrolled) {
        throw new ApiError(
          409,
          'This learner is already placed. Move or unplace them from the learner profile instead.'
        );
      }

      return tx.admissionApplication.update({
        where: { id },
        data: {
          status: payload.status,
          notes: payload.notes !== undefined ? payload.notes || null : existing.notes,
          reviewedAt: new Date(),
          reviewedBy: actorId ?? null,
        },
        include: applicationInclude,
      });
    });

    res.json({ application: mapApplication(updated) });
  })
);

/** Review several applications at once, reporting each outcome. */
router.post(
  '/applications/bulk',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    const payload = bulkReviewSchema.parse(req.body);

    const results: Array<{ id: string; status: string; error?: string }> = [];
    for (const id of payload.applicationIds) {
      try {
        const resolvedId = assertObjectId(id, 'application id');
        const existing = await prisma.admissionApplication.findUnique({
          where: { id: resolvedId },
        });
        if (!existing) {
          throw new ApiError(404, 'Application not found.');
        }
        if (existing.status === AdmissionStatus.enrolled) {
          throw new ApiError(409, 'Already placed.');
        }

        await prisma.admissionApplication.update({
          where: { id: resolvedId },
          data: {
            status: payload.status,
            notes: payload.notes !== undefined ? payload.notes || null : existing.notes,
            reviewedAt: new Date(),
            reviewedBy: actorId ?? null,
          },
        });
        results.push({ id, status: payload.status });
      } catch (err) {
        results.push({
          id,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Could not review this application.',
        });
      }
    }

    res.json({ results });
  })
);

/**
 * Place an accepted applicant into a class, optional stream and session.
 *
 * This is the step that makes a learner operational: the Enrollment it creates
 * is what attendance, results and the class register read. The application is
 * marked `enrolled` in the same transaction so a placement can never exist
 * without the application that authorised it - and never without the review.
 */
router.post(
  '/applications/:id/enroll',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    const id = assertObjectId(req.params.id, 'application id');
    const payload = enrollSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    const result = await prisma.$transaction(async (tx) => {
      const application = await tx.admissionApplication.findUnique({
        where: { id },
        include: {
          applicant: { include: { user: { select: { id: true, name: true, email: true } } } },
        },
      });
      if (!application) {
        throw new ApiError(404, 'Application not found.');
      }
      if (application.status === AdmissionStatus.enrolled) {
        throw new ApiError(409, 'This learner is already placed.');
      }

      // 1. The learner must be a member of this school.
      const applicantUserId = application.applicant.user?.id;
      if (!applicantUserId) {
        throw new ApiError(409, 'This application has no learner account attached.');
      }
      const membership = await tx.schoolMembership.findFirst({
        where: { userId: applicantUserId, schoolId },
      });
      if (!membership) {
        throw new ApiError(403, 'That learner does not belong to your school.');
      }

      // 2. The target class must exist in this school.
      const targetClass = await tx.class.findFirst({ where: { id: payload.classId, schoolId } });
      if (!targetClass) {
        throw new ApiError(404, 'The selected class does not exist in your school.');
      }

      // 3. A stream, when given, must belong to that class - the hierarchy is
      //    Class → Stream, so a stream from another class is a mis-placement.
      let streamId: string | null = null;
      if (payload.streamId) {
        const stream = await tx.stream.findFirst({
          where: { id: payload.streamId, classId: targetClass.id },
        });
        if (!stream) {
          throw new ApiError(400, 'The selected stream does not belong to the chosen class.');
        }
        streamId = stream.id;
      }

      // 4. The session, when given, must belong to this school.
      let academicYearId: string | null = null;
      if (payload.academicYearId) {
        const year = await tx.academicYear.findFirst({
          where: { id: payload.academicYearId, schoolId },
        });
        if (!year) {
          throw new ApiError(404, 'The selected academic session does not belong to your school.');
        }
        academicYearId = year.id;
      }

      // 5. A learner is placed once: re-placing would split their record across
      //    duplicate enrolments, and session moves belong to transitions.
      const duplicate = await tx.enrollment.findFirst({
        where: { studentId: applicantUserId, classId: targetClass.id },
      });
      if (duplicate) {
        throw new ApiError(
          409,
          'This learner is already enrolled in that class. Move them from the learner profile instead.'
        );
      }

      // 6. Optional parent/guardian link at entry.
      if (payload.parentUserId) {
        const parentProfile = await tx.parentProfile.findUnique({
          where: { userId: payload.parentUserId },
        });
        if (parentProfile) {
          const link = await tx.parentChildLink.findUnique({
            where: {
              parentId_childId: { parentId: parentProfile.id, childId: application.applicantId },
            },
          });
          if (!link) {
            await tx.parentChildLink.create({
              data: { parentId: parentProfile.id, childId: application.applicantId },
            });
          }
        }
      }

      // 7. The placement.
      const enrollment = await tx.enrollment.create({
        data: {
          studentId: applicantUserId,
          classId: targetClass.id,
          streamId,
          academicYearId,
          startDate: new Date(),
        },
        include: placementInclude,
      });

      // 8. Profile reflects the placement, so a directory read agrees with it.
      await tx.studentProfile.update({
        where: { id: application.applicantId },
        data: {
          gradeLevel: targetClass.gradeLevel ?? undefined,
          enrollmentDate: new Date(),
        },
      });

      // 9. The application is resolved by the placement it produced.
      const updated = await tx.admissionApplication.update({
        where: { id },
        data: {
          status: AdmissionStatus.enrolled,
          reviewedAt: new Date(),
          reviewedBy: actorId ?? null,
        },
        include: applicationInclude,
      });

      return { enrollment, application: updated };
    });

    res.status(201).json({
      placement: mapPlacement(result.enrollment),
      application: mapApplication(result.application),
    });
  })
);

/** Withdraw an application that has not been placed. */
router.delete(
  '/applications/:id',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const id = assertObjectId(req.params.id, 'application id');

    const existing = await prisma.admissionApplication.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, 'Application not found.');
    }
    if (existing.status === AdmissionStatus.enrolled) {
      throw new ApiError(409, 'This learner is already placed and cannot be withdrawn here.');
    }

    await prisma.admissionApplication.delete({ where: { id } });
    res.status(204).send();
  })
);

/** Class placements in this school, filterable by class, stream or session. */
router.get(
  '/placements',
  requireEnrollmentView,
  asyncHandler(async (req: Request, res: Response) => {
    const query = listPlacementsSchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);

    // Scoped through the class relation: a placement belongs to this school when
    // the class it points at does.
    const enrollments = await prisma.enrollment.findMany({
      where: {
        class: { schoolId },
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.streamId ? { streamId: query.streamId } : {}),
        ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
        ...(query.search
          ? {
              student: {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { firstName: { contains: query.search, mode: 'insensitive' } },
                  { lastName: { contains: query.search, mode: 'insensitive' } },
                  { email: { contains: query.search, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: placementInclude,
    });

    res.json({ placements: enrollments.map(mapPlacement) });
  })
);

/**
 * Remove a placement.
 *
 * The learner's attendance and results are untouched by design: they belong to
 * the academic record, not to the placement. The application that authorised
 * the placement is returned to `accepted` in the same transaction, so the
 * learner is not left claiming to be placed with no placement to show for it -
 * they can be re-placed or withdrawn from a truthful state.
 */
router.delete(
  '/placements/:id',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const id = assertObjectId(req.params.id, 'placement id');

    await prisma.$transaction(async (tx) => {
      const existing = await tx.enrollment.findUnique({
        where: { id },
        include: { class: { select: { id: true, schoolId: true, name: true } } },
      });
      if (!existing || existing.class?.schoolId !== schoolId) {
        throw new ApiError(404, 'Placement not found.');
      }

      await tx.enrollment.delete({ where: { id } });

      if (existing.studentId) {
        const profile = await tx.studentProfile.findUnique({
          where: { userId: existing.studentId },
          select: { id: true },
        });
        if (profile) {
          await tx.admissionApplication.updateMany({
            where: { applicantId: profile.id, status: AdmissionStatus.enrolled },
            data: { status: AdmissionStatus.accepted },
          });
        }
      }
    });

    res.status(204).send();
  })
);

/**
 * Bulk enrollment: bring a whole set of people into the school at once.
 *
 * This is the hub's front door for every category of person - learners,
 * guardians, teachers and other staff - in one run. Each row is onboarded in
 * its own transaction, so one bad row is reported as failed and the rest still
 * land; the batch records what each row became.
 *
 * Staff roles and PARENT get their profile without any placement, because
 * neither is taught. A learner is placed only when the row says a class.
 */
router.post(
  '/batches',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = createBatchSchema.parse(req.body);
    const actorId = req.user?.id ?? null;

    const rows = payload.entries.map((entry, index) => ({
      entry,
      rowNumber: index + 1,
      status: EnrollmentEntryStatus.pending as EnrollmentEntryStatus,
      userId: null as string | null,
      error: null as string | null,
    }));

    // The batch is written first so a partial import still leaves a trace of
    // what was attempted, even if the process dies mid-run.
    const batch = await prisma.enrollmentBatch.create({
      data: {
        schoolId,
        status: EnrollmentBatchStatus.draft,
        source: payload.source,
        notes: payload.notes,
        createdById: actorId,
        totalRows: rows.length,
        entries: {
          create: rows.map((row) => ({
            rowNumber: row.rowNumber,
            role: row.entry.role,
            status: EnrollmentEntryStatus.pending,
            email: row.entry.email.trim().toLowerCase(),
            firstName: row.entry.firstName,
            lastName: row.entry.lastName,
            name: row.entry.name,
            phone: row.entry.phone,
            gradeLevel: row.entry.gradeLevel,
            dateOfBirth: row.entry.dateOfBirth ? new Date(row.entry.dateOfBirth) : null,
            gender: row.entry.gender,
            admissionNumber: row.entry.admissionNumber,
            classId: row.entry.classId,
            streamId: row.entry.streamId,
            academicYearId: row.entry.academicYearId,
            parentEmail: row.entry.parentEmail,
            employeeId: row.entry.employeeId,
            position: row.entry.position,
            department: row.entry.department,
            hireDate: row.entry.hireDate ? new Date(row.entry.hireDate) : null,
          })),
        },
      },
      select: { id: true },
    });

    for (const row of rows) {
      try {
        // One transaction per row: a rejected row must not undo the rows that
        // already succeeded, which is the whole point of a bulk import.
        const outcome = await prisma.$transaction((tx) =>
          onboardEntry(tx, schoolId, row.entry, row.rowNumber)
        );
        row.status = outcome.status;
        row.userId = outcome.userId;
        row.error = outcome.error;
      } catch (err) {
        row.status = EnrollmentEntryStatus.failed;
        row.error = err instanceof Error ? err.message : 'Could not onboard this person.';
      }

      await prisma.enrollmentBatchEntry.updateMany({
        where: { batchId: batch.id, rowNumber: row.rowNumber },
        data: { status: row.status, userId: row.userId, error: row.error },
      });
    }

    const counts = countBatch(rows);
    const stored = await prisma.enrollmentBatch.update({
      where: { id: batch.id },
      data: {
        status: EnrollmentBatchStatus.completed,
        enrolledCount: counts.enrolledCount,
        duplicateCount: counts.duplicateCount,
        failedCount: counts.failedCount,
      },
      include: batchInclude,
    });

    res.status(201).json({ batch: mapBatch(stored) });
  })
);

/** Bulk enrollment history for this school, newest first. */
router.get(
  '/batches',
  requireEnrollmentView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = listBatchesSchema.parse(req.query);

    const batches = await prisma.enrollmentBatch.findMany({
      where: { schoolId, ...(query.status ? { status: query.status } : {}) },
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      include: batchInclude,
    });

    res.json({ batches: batches.map(mapBatch) });
  })
);

/** One batch with every row and its outcome. */
router.get(
  '/batches/:id',
  requireEnrollmentView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const id = assertObjectId(req.params.id, 'batch id');
    const query = listBatchEntriesSchema.parse(req.query);

    const batch = await prisma.enrollmentBatch.findFirst({
      where: { id, schoolId },
      include: batchInclude,
    });
    if (!batch) {
      throw new ApiError(404, 'Enrollment batch not found.');
    }

    const mapped = mapBatch(batch);
    if (query.status) {
      mapped.entries = mapped.entries.filter(
        (entry: { status: EnrollmentEntryStatus }) => entry.status === query.status
      );
    }

    res.json({ batch: mapped });
  })
);

/**
 * Abandon or discard a batch record.
 *
 * The people it onboarded are left exactly as they are: a batch is the record
 * of an import, not the owner of the accounts it created, and deleting it must
 * not delete staff and learners out of the school.
 */
router.delete(
  '/batches/:id',
  requireEnrollmentManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const id = assertObjectId(req.params.id, 'batch id');

    const existing = await prisma.enrollmentBatch.findFirst({ where: { id, schoolId } });
    if (!existing) {
      throw new ApiError(404, 'Enrollment batch not found.');
    }

    await prisma.enrollmentBatch.delete({ where: { id } });
    res.status(204).send();
  })
);
