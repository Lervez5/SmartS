import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';

/** Examinations, backed by the Examination model and its attempts. */

const listSchema = z.object({
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

const createSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  classId: z.string().optional(),
  subjectId: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  duration: z.coerce.number().int().min(1).max(1440).optional(),
  maxScore: z.coerce.number().min(0).optional(),
});

export const router: Router = Router();

router.get(
  '/',
  requirePermissions('examinations.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);

    const examinations = await prisma.examination.findMany({
      where: {
        ...(query.classId ? { classId: query.classId } : {}),
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
        ...(query.from || query.to
          ? {
              startDate: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        _count: { select: { examAttempts: true } },
      },
      orderBy: { startDate: 'desc' },
    });

    res.json({ examinations });
  })
);

router.get(
  '/:id',
  requirePermissions('examinations.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const exam = await prisma.examination.findUnique({
      where: { id: req.params.id },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        examAttempts: {
          include: { student: { select: { id: true, name: true } } },
        },
      },
    });
    if (!exam) throw new ApiError(404, 'Examination not found');
    res.json(exam);
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
        classId: payload.classId,
        subjectId: payload.subjectId,
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        duration: payload.duration,
        maxScore: payload.maxScore,
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(exam);
  })
);
