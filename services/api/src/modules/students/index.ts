import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

/** Student directory, backed by StudentProfile. */

const listSchema = z.object({
  gradeLevel: z.string().optional(),
  search: z.string().optional(),
  /**
   * Narrows the directory to an account state. `User.status` is the only
   * lifecycle field the learner model has; there is no separate enrolment
   * status on StudentProfile.
   */
  status: z.enum(['pending', 'active', 'suspended', 'archived']).optional(),
  /**
   * Page size for the directory. Bounded because the query is not paginated
   * with a cursor: a single cap keeps one oversized request from materialising
   * the whole school into memory.
   */
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  userId: z.string().min(1),
  gradeLevel: z.string().max(32).optional(),
  admissionId: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  enrollmentDate: z.string().optional(),
});

/**
 * Editable learner fields.
 *
 * Deliberately the same set the create route accepts, so a learner cannot be
 * created with values it cannot later be corrected to. Every field is optional
 * so a partial edit is expressible, and `null` is allowed where clearing a
 * value is meaningful. Names live on User and are edited through the user
 * routes, not here.
 */
const updateSchema = z.object({
  gradeLevel: z.string().max(32).nullable().optional(),
  admissionId: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other', 'unspecified']).nullable().optional(),
  enrollmentDate: z.string().nullable().optional(),
});

/**
 * Whether a term is shaped like a Mongo ObjectId.
 *
 * Used to decide when it is safe to filter `admissionId`, which Prisma types as
 * an ObjectId and therefore validates before the query runs.
 */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
function isObjectIdLike(value: string): boolean {
  return OBJECT_ID.test(value);
}

export const router: Router = Router();

router.get(
  '/',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const students = await prisma.studentProfile.findMany({
      where: {
        ...(query.gradeLevel ? { gradeLevel: query.gradeLevel } : {}),
        ...(query.status ? { user: { status: query.status } } : {}),
        ...(query.search
          ? {
              OR: [
                { gradeLevel: { contains: query.search, mode: 'insensitive' } },
                // The directory is searched the way a registrar searches it: by
                // any name part, the email, or the admission identifier.
                { user: { name: { contains: query.search, mode: 'insensitive' } } },
                { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
                { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
                { user: { email: { contains: query.search, mode: 'insensitive' } } },
                // `admissionId` is declared @db.ObjectId, so Prisma validates
                // any filter value for it as a hex id. Applying `contains`
                // unconditionally made every ordinary search fail with a 500,
                // so the branch is only added when the term really is an id.
                ...(isObjectIdLike(query.search)
                  ? [{ admissionId: { equals: query.search } }]
                  : []),
              ],
            }
          : {}),
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
            avatar: true,
            phone: true,
            // Class placement hangs off User, not StudentProfile: the
            // Enrollment relation is declared on User. A learner is placed
            // through Enrollment, so the directory follows the same path —
            // and returns both the placement and StudentProfile.gradeLevel
            // because the two can disagree.
            enrollments: {
              take: 1,
              include: {
                class: {
                  select: {
                    id: true,
                    name: true,
                    classCode: true,
                    gradeLevel: true,
                  },
                },
              },
            },
          },
        },
        _count: { select: { parentLinks: true } },
      },
      orderBy: [{ user: { name: 'asc' } }, { createdAt: 'desc' }],
      ...(query.limit ? { take: query.limit } : {}),
    });

    res.json({
      students: students.map((s) => {
        const placement = s.user.enrollments[0]?.class ?? null;
        return {
          id: s.id,
          userId: s.userId,
          name: s.user.name,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          email: s.user.email,
          phone: s.user.phone,
          avatar: s.user.avatar,
          status: s.user.status,
          gradeLevel: s.gradeLevel,
          admissionId: s.admissionId,
          dateOfBirth: s.dateOfBirth,
          gender: s.gender,
          enrollmentDate: s.enrollmentDate,
          guardians: s._count.parentLinks,
          // Null when the learner is not placed in a class. The model has no
          // stream, so `stream` is deliberately absent rather than invented.
          class: placement
            ? {
                id: placement.id,
                name: placement.name,
                classCode: placement.classCode,
                gradeLevel: placement.gradeLevel,
              }
            : null,
        };
      }),
    });
  })
);

router.post(
  '/',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) throw new ApiError(404, 'User not found');

    const existing = await prisma.studentProfile.findUnique({
      where: { userId: payload.userId },
    });
    if (existing) throw new ApiError(409, 'That user already has a student profile');

    const student = await prisma.studentProfile.create({
      data: {
        userId: payload.userId,
        gradeLevel: payload.gradeLevel,
        admissionId: payload.admissionId,
        dateOfBirth: payload.dateOfBirth ? new Date(payload.dateOfBirth) : null,
        gender: payload.gender as never,
        enrollmentDate: payload.enrollmentDate ? new Date(payload.enrollmentDate) : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(student);
  })
);

/**
 * Update a learner profile.
 *
 * `students.manage` is the same gate the create route uses. Grade placement is
 * NOT editable here: a learner joins a class through Enrollment, so changing
 * gradeLevel alone would leave the placement and the profile disagreeing.
 * Class placement has no endpoint yet.
 */
router.patch(
  '/:id',
  requirePermissions('students.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateSchema.parse(req.body);

    const existing = await prisma.studentProfile.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new ApiError(404, 'Student profile not found');

    const data: Record<string, unknown> = {};
    if (payload.gradeLevel !== undefined) data.gradeLevel = payload.gradeLevel;
    if (payload.admissionId !== undefined) data.admissionId = payload.admissionId;
    if (payload.gender !== undefined) data.gender = payload.gender;
    if (payload.dateOfBirth !== undefined) {
      data.dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth) : null;
    }
    if (payload.enrollmentDate !== undefined) {
      data.enrollmentDate = payload.enrollmentDate ? new Date(payload.enrollmentDate) : null;
    }

    if (Object.keys(data).length === 0) {
      throw new ApiError(400, 'No editable fields were supplied');
    }

    const updated = await prisma.studentProfile.update({
      where: { id: req.params.id },
      data,
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    });

    res.json({ student: updated });
  })
);
