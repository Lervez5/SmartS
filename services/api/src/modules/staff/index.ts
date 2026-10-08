import { Router, type Request, type Response } from 'express';
import { Prisma, StaffStatus, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

/** Staff directory, backed by StaffProfile. */

const listSchema = z.object({
  /** Employment state, from StaffProfile.status. */
  status: z.nativeEnum(StaffStatus).optional(),
  /**
   * Account / login state, from User.status.
   *
   * Deliberately separate from `status`: a staff member can be employed and
   * still unable to sign in (suspended), or hold an account and be employed on
   * leave. Collapsing them would hide a real distinction.
   */
  accountStatus: z.nativeEnum(UserStatus).optional(),
  /** Filter by assigned role name, e.g. TEACHER. */
  role: z.string().optional(),
  search: z.string().optional(),
  sort: z.enum(['name_asc', 'name_desc', 'newest', 'oldest', 'hired_asc', 'hired_desc']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const createSchema = z.object({
  userId: z.string().min(1),
  position: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  employeeId: z.string().max(64).optional(),
  hireDate: z.string().optional(),
});

const updateSchema = z.object({
  position: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  status: z.nativeEnum(StaffStatus).optional(),
});

export const router: Router = Router();

router.get(
  '/',
  requirePermissions('staff.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    /**
     * Sorting is explicit rather than fixed, because a staff directory is read
     * by name far more often than by creation time. Declared as a
     * `StaffProfileOrderByWithRelationInput` so the relation key stays typed.
     */
    const orderBy: Prisma.StaffProfileOrderByWithRelationInput =
      query.sort === 'name_desc'
        ? { user: { name: 'desc' } }
        : query.sort === 'newest'
          ? { createdAt: 'desc' }
          : query.sort === 'oldest'
            ? { createdAt: 'asc' }
            : query.sort === 'hired_asc'
              ? { hireDate: 'asc' }
              : query.sort === 'hired_desc'
                ? { hireDate: 'desc' }
                : { user: { name: 'asc' } };

    const staff = await prisma.staffProfile.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.accountStatus ? { user: { status: query.accountStatus } } : {}),
        ...(query.role
          ? { user: { roleMemberships: { some: { role: { name: query.role } } } } }
          : {}),
        ...(query.search
          ? {
              OR: [
                { position: { contains: query.search, mode: 'insensitive' } },
                { department: { contains: query.search, mode: 'insensitive' } },
                // employeeId is a plain String, so a substring match is valid.
                { employeeId: { contains: query.search, mode: 'insensitive' } },
                { user: { name: { contains: query.search, mode: 'insensitive' } } },
                { user: { firstName: { contains: query.search, mode: 'insensitive' } } },
                { user: { lastName: { contains: query.search, mode: 'insensitive' } } },
                { user: { email: { contains: query.search, mode: 'insensitive' } } },
                { user: { phone: { contains: query.search, mode: 'insensitive' } } },
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
            phone: true,
            status: true,
            avatar: true,
            roleMemberships: { select: { role: { select: { id: true, name: true } } } },
          },
        },
      },
      orderBy,
      ...(query.limit ? { take: query.limit } : {}),
    });

    res.json({
      staff: staff.map((s) => ({
        id: s.id,
        userId: s.userId,
        name: s.user.name,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        email: s.user.email,
        phone: s.user.phone,
        avatar: s.user.avatar,
        // Account / login state, distinct from employment status below.
        userStatus: s.user.status,
        roles: s.user.roleMemberships.map((m) => m.role),
        position: s.position,
        department: s.department,
        employeeId: s.employeeId,
        hireDate: s.hireDate,
        status: s.status,
      })),
    });
  })
);

router.post(
  '/',
  requirePermissions('staff.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = createSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) throw new ApiError(404, 'User not found');

    const existing = await prisma.staffProfile.findUnique({
      where: { userId: payload.userId },
    });
    if (existing) throw new ApiError(409, 'That user already has a staff profile');

    const staff = await prisma.staffProfile.create({
      data: {
        userId: payload.userId,
        position: payload.position,
        department: payload.department,
        employeeId: payload.employeeId,
        hireDate: payload.hireDate ? new Date(payload.hireDate) : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(staff);
  })
);

router.put(
  '/:id',
  requirePermissions('staff.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = updateSchema.parse(req.body);
    const existing = await prisma.staffProfile.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) throw new ApiError(404, 'Staff member not found');

    const staff = await prisma.staffProfile.update({
      where: { id: req.params.id },
      data: payload,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(staff);
  })
);
