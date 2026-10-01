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
});

const createSchema = z.object({
  userId: z.string().min(1),
  gradeLevel: z.string().max(32).optional(),
  admissionId: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  enrollmentDate: z.string().optional(),
});

export const router: Router = Router();

router.get(
  '/',
  requirePermissions('students.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const students = await prisma.studentProfile.findMany({
      where: {
        ...(query.gradeLevel ? { gradeLevel: query.gradeLevel } : {}),
        ...(query.search
          ? {
              OR: [
                { gradeLevel: { contains: query.search, mode: 'insensitive' } },
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
          },
        },
        _count: { select: { parentLinks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      students: students.map((s) => ({
        id: s.id,
        userId: s.userId,
        name: s.user.name,
        email: s.user.email,
        avatar: s.user.avatar,
        status: s.user.status,
        gradeLevel: s.gradeLevel,
        admissionId: s.admissionId,
        dateOfBirth: s.dateOfBirth,
        gender: s.gender,
        enrollmentDate: s.enrollmentDate,
        guardians: s._count.parentLinks,
      })),
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
