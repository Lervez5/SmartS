import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import {
  seedRacefieldScales,
  getActiveScales,
  getScalesByGrade,
  countGradesUsingScale,
  RACEFIELD_SEED_DATA,
  validateBands,
  type RacefieldScaleWithBands,
} from './racefield';

export const router: Router = Router();

router.use(requireSchoolScope());

const bandSchema = z.object({
  label: z.string().min(1).max(120),
  code: z.string().min(1).max(32),
  minScore: z.coerce.number(),
  maxScore: z.coerce.number(),
  points: z.coerce.number().optional().nullable(),
});

const scaleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  gradeMin: z.coerce.number().int().min(1).max(9),
  gradeMax: z.coerce.number().int().min(1).max(9),
  version: z.coerce.number().int().min(1).optional().default(1),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  effectiveFrom: z.string().optional().nullable(),
  bands: z.array(bandSchema).min(1),
});

function mapScale(s: any): RacefieldScaleWithBands {
  return {
    id: s.id,
    schoolId: s.schoolId,
    name: s.name,
    description: s.description,
    gradeMin: s.gradeMin,
    gradeMax: s.gradeMax,
    version: s.version,
    isDefault: s.isDefault,
    isActive: s.isActive,
    effectiveFrom: s.effectiveFrom,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    bands: s.bands.map((b: any) => ({
      id: b.id,
      label: b.label,
      code: b.code,
      minScore: b.minScore,
      maxScore: b.maxScore,
      points: b.points,
    })),
  };
}

router.get(
  '/',
  requirePermissions('grading.view'),
  asyncHandler(async (_req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(_req);
    const grade = typeof _req.query.grade === 'string' ? _req.query.grade : undefined;

    let scales: RacefieldScaleWithBands[];
    if (grade) {
      scales = await getScalesByGrade(schoolId, grade);
    } else {
      scales = await getActiveScales(schoolId);
    }
    res.json({ scales });
  })
);

router.get(
  '/:id',
  requirePermissions('grading.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const scale = await prisma.racefieldScale.findFirst({
      where: { id: req.params.id, schoolId },
      include: { bands: { orderBy: { minScore: 'desc' } } },
    });
    if (!scale) throw new ApiError(404, 'Scale not found');

    const usedCount = await countGradesUsingScale(scale.id);

    res.json({ scale: mapScale(scale), inUse: usedCount > 0, usedCount });
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

    validateBands(payload.bands);

    const overlapping = await prisma.racefieldScale.findFirst({
      where: {
        schoolId,
        isActive: true,
        OR: [{ gradeMin: { lte: payload.gradeMax }, gradeMax: { gte: payload.gradeMin } }],
      },
    });
    if (overlapping) {
      throw new ApiError(
        409,
        'An active scale for this grade range already exists for this school.'
      );
    }

    const scale = await prisma.racefieldScale.create({
      data: {
        schoolId,
        name: payload.name,
        description: payload.description ?? null,
        gradeMin: payload.gradeMin,
        gradeMax: payload.gradeMax,
        version: payload.version,
        isDefault: payload.isDefault,
        isActive: payload.isActive,
        effectiveFrom: payload.effectiveFrom ? new Date(payload.effectiveFrom) : null,
        bands: {
          create: payload.bands.map((b) => ({
            label: b.label,
            code: b.code,
            minScore: b.minScore,
            maxScore: b.maxScore,
            points: b.points ?? null,
          })),
        },
      },
      include: { bands: { orderBy: { minScore: 'desc' } } },
    });

    res.status(201).json({ scale: mapScale(scale) });
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

    if (payload.bands) {
      validateBands(payload.bands);
    }

    const overlapping = await prisma.racefieldScale.findFirst({
      where: {
        schoolId,
        id: { not: existing.id },
        isActive: true,
        OR: [{ gradeMin: { lte: nextMax }, gradeMax: { gte: nextMin } }],
      },
    });
    if (overlapping) {
      throw new ApiError(
        409,
        'An active scale for this grade range already exists for this school.'
      );
    }

    const updateData: any = {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.gradeMin !== undefined ? { gradeMin: payload.gradeMin } : {}),
      ...(payload.gradeMax !== undefined ? { gradeMax: payload.gradeMax } : {}),
      ...(payload.version !== undefined ? { version: payload.version } : {}),
      ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
      ...(payload.effectiveFrom !== undefined
        ? { effectiveFrom: payload.effectiveFrom ? new Date(payload.effectiveFrom) : null }
        : {}),
    };

    if (payload.bands) {
      updateData.bands = {
        deleteMany: {},
        create: payload.bands.map((b) => ({
          label: b.label,
          code: b.code,
          minScore: b.minScore,
          maxScore: b.maxScore,
          points: b.points ?? null,
        })),
      };
    }

    if (payload.isActive === false && existing.isActive) {
      const usedCount = await countGradesUsingScale(existing.id);
      if (usedCount > 0) {
        throw new ApiError(
          409,
          `This scale is referenced by ${usedCount} finalized result(s). Deactivate a new version in its place rather than mutating historical grading rules.`
        );
      }
    }

    const scale = await prisma.racefieldScale.update({
      where: { id: existing.id },
      data: updateData,
      include: { bands: { orderBy: { minScore: 'desc' } } },
    });

    res.json({ scale: mapScale(scale) });
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

    const usedCount = await countGradesUsingScale(existing.id);
    if (usedCount > 0) {
      throw new ApiError(
        409,
        `This scale is referenced by ${usedCount} finalized result(s). Delete a new version in its place rather than mutating historical grading rules.`
      );
    }

    await prisma.racefieldScale.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);

router.get(
  '/results',
  requirePermissions('grading.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const learnerId = typeof req.query.learnerId === 'string' ? req.query.learnerId : undefined;
    const learnerIdsParam =
      typeof req.query.learnerIds === 'string' ? req.query.learnerIds : undefined;
    const { schoolId } = schoolScopeOf(req);

    const where: any = {
      exam: { class: { schoolId } },
      ...(learnerId
        ? { studentId: learnerId }
        : learnerIdsParam
          ? {
              studentId: {
                in: learnerIdsParam
                  .split(',')
                  .map((id) => id.trim())
                  .filter(Boolean),
              },
            }
          : {}),
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
        racefieldBand: { select: { label: true, code: true } },
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
          racefieldBandCode: g.racefieldBandCode ?? g.racefieldBand?.code ?? null,
          racefieldPoints: g.racefieldPoints ?? null,
          gradedAt: g.gradedAt.toISOString(),
        };
      });

    res.json({ results });
  })
);

router.get(
  '/seed-data',
  requirePermissions('grading.view'),
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ scales: RACEFIELD_SEED_DATA });
  })
);
