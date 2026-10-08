import { Router, type Request, type Response } from 'express';
import { StaffStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

/** Staff directory, backed by StaffProfile. */

const listSchema = z.object({
  status: z.nativeEnum(StaffStatus).optional(),
  search: z.string().optional(),
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

    const staff = await prisma.staffProfile.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { position: { contains: query.search, mode: 'insensitive' } },
                { department: { contains: query.search, mode: 'insensitive' } },
                {
                  user: {
                    name: { contains: query.search, mode: 'insensitive' },
                  },
                },
                {
                  user: {
                    email: { contains: query.search, mode: 'insensitive' },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            avatar: true,
            roleMemberships: { select: { role: { select: { name: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      staff: staff.map((s) => ({
        id: s.id,
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        avatar: s.user.avatar,
        userStatus: s.user.status,
        role: s.user.roleMemberships[0]?.role.name ?? null,
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
