import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import {
  seedRacefieldScales,
  getActiveScales,
} from './racefield';

export const router: Router = Router();

router.use(requireSchoolScope());

const scaleSchema = z.object({
  name: z.string().min(1).max(120),
  gradeMin: z.coerce.number().int().min(1).max(9),
  gradeMax: z.coerce.number().int().min(1).max(9),
  isActive: z.boolean().optional(),
  bands: z
    .array(
      z.object({
        label: z.string().min(1).max(120),
        minScore: z.coerce.number(),
        maxScore: z.coerce.number(),
      })
    )
    .min(1),
});

router.get(
  '/',
  requirePermissions('grading.view'),
  asyncHandler(async (_req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(_req);
    const scales = await getActiveScales(schoolId);
    res.json({ scales });
  })
);

router.post(
  '/seed',
  requirePermissions('grading.manage'),
  asyncHandler(async (_req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(_req);
    const scales = await seedRacefieldScales(schoolId);
    res.status(201).json({ scales });
  })
);

router.post(
  '/',
  requirePermissions('grading.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = scaleSchema.parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    if (payload.gradeMin > payload.gradeMax) {
      throw new ApiError(400, 'gradeMin must be less than or equal to gradeMax');
    }

    const overlapping = await prisma.racefieldScale.findFirst({
      where: {
        schoolId,
        OR: [
          {
            gradeMin: { lte: payload.gradeMax },
            gradeMax: { gte: payload.gradeMin },
          },
        ],
      },
    });
    if (overlapping) {
      throw new ApiError(409, 'This scale overlaps an existing grade range for this school.');
    }

    const scale = await prisma.racefieldScale.create({
      data: {
        schoolId,
        name: payload.name,
        gradeMin: payload.gradeMin,
        gradeMax: payload.gradeMax,
        isActive: payload.isActive ?? true,
        bands: {
          create: payload.bands.map((b) => ({
            label: b.label,
            minScore: b.minScore,
            maxScore: b.maxScore,
          })),
        },
      },
      include: { bands: { orderBy: { minScore: 'desc' } } },
    });

    res.status(201).json({ scale });
  })
);

router.patch(
  '/:id',
  requirePermissions('grading.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const payload = scaleSchema.partial().parse(req.body);
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.racefieldScale.findFirst({
      where: { id: req.params.id, schoolId },
    });
    if (!existing) throw new ApiError(404, 'Scale not found');

    const nextMin = payload.gradeMin ?? existing.gradeMin;
    const nextMax = payload.gradeMax ?? existing.gradeMax;

    if (nextMin > nextMax) {
      throw new ApiError(400, 'gradeMin must be less than or equal to gradeMax');
    }

    const overlapping = await prisma.racefieldScale.findFirst({
      where: {
        schoolId,
        id: { not: existing.id },
        OR: [
          {
            gradeMin: { lte: nextMax },
            gradeMax: { gte: nextMin },
          },
        ],
      },
    });
    if (overlapping) {
      throw new ApiError(409, 'This scale overlaps an existing grade range for this school.');
    }

    const scale = await prisma.racefieldScale.update({
      where: { id: existing.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.gradeMin !== undefined ? { gradeMin: payload.gradeMin } : {}),
        ...(payload.gradeMax !== undefined ? { gradeMax: payload.gradeMax } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
        ...(payload.bands !== undefined
          ? {
              bands: {
                deleteMany: {},
                create: payload.bands.map((b) => ({
                  label: b.label,
                  minScore: b.minScore,
                  maxScore: b.maxScore,
                })),
              },
            }
          : {}),
      },
      include: { bands: { orderBy: { minScore: 'desc' } } },
    });

    res.json({ scale });
  })
);

router.delete(
  '/:id',
  requirePermissions('grading.manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const existing = await prisma.racefieldScale.findFirst({
      where: { id: req.params.id, schoolId },
    });
    if (!existing) throw new ApiError(404, 'Scale not found');

    await prisma.racefieldScale.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

router.get(
  '/results',
  requirePermissions('grading.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const learnerId = typeof req.query.learnerId === 'string' ? req.query.learnerId : undefined;
    const learnerIdsParam = typeof req.query.learnerIds === 'string' ? req.query.learnerIds : undefined;
    const { schoolId } = schoolScopeOf(req);

    const where: Prisma.GradeWhereInput = {
      exam: { class: { schoolId } },
      ...(learnerId ? { studentId: learnerId } : learnerIdsParam ? { studentId: { in: learnerIdsParam.split(',').map((id) => id.trim()).filter(Boolean) } } : {}),
    };

    const grades = await prisma.grade.findMany({
      where,
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            assessmentType: true,
            maxScore: true,
            class: { select: { name: true, gradeLevel: true } },
            term: { select: { name: true, termNumber: true } },
            academicYear: { select: { name: true, label: true } },
          },
        },
        student: { select: { id: true, name: true, firstName: true, lastName: true } },
        subject: { select: { id: true, name: true, code: true } },
        racefieldBand: { select: { label: true } },
      },
      orderBy: { gradedAt: 'desc' },
    });

    const results = grades
      .filter((g) => g.exam)
      .map((g) => {
        const learnerName =
          g.student?.name ??
          [g.student?.firstName, g.student?.lastName].filter(Boolean).join(' ') ??
          'Unknown';
        return {
          id: g.id,
          learnerName,
          learnerId: g.studentId,
          assessment: {
            id: g.exam!.id,
            title: g.exam!.title,
            assessmentType: g.exam!.assessmentType,
            maxScore: g.exam!.maxScore,
            className: g.exam!.class?.name ?? null,
            gradeLevel: g.exam!.class?.gradeLevel ?? null,
            termName: g.exam!.term ? `Term ${g.exam!.term.termNumber}` : null,
            sessionName: g.exam!.academicYear?.label ?? g.exam!.academicYear?.name ?? null,
          },
          learningArea: {
            id: g.subject!.id,
            name: g.subject!.name,
            code: g.subject!.code,
          },
          score: g.value,
          competencyLevel: g.competencyLevel ?? null,
          racefieldBand: g.racefieldBand?.label ?? null,
          gradedAt: g.gradedAt.toISOString(),
        };
      });

    res.json({ results });
  })
);
