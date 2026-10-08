import { prisma } from '../../infrastructure/database';
import { ApiError } from '../../shared/logger';

export interface RacefieldBand {
  id: string;
  label: string;
  code: string;
  minScore: number;
  maxScore: number;
  points: number | null;
}

export interface ResolvedRacefield {
  scaleId: string;
  scaleName: string;
  scaleVersion: number;
  bandId: string;
  bandLabel: string;
  bandCode: string;
  bandPoints: number | null;
  normalisedScore: number;
}

export interface RacefieldScaleWithBands {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  gradeMin: number;
  gradeMax: number;
  version: number;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: Date | null;
  createdAt: Date;
  updatedAt: Date;
  bands: RacefieldBand[];
}

export interface SeedScaleInput {
  name: string;
  description: string | null;
  gradeMin: number;
  gradeMax: number;
  isActive: boolean;
  bands: Array<{
    label: string;
    code: string;
    minScore: number;
    maxScore: number;
    points: number | null;
  }>;
}

export const RACEFIELD_SEED_DATA: SeedScaleInput[] = [
  {
    name: 'Junior Grading System',
    description: 'Racefield grading standard for Grades 7-9',
    gradeMin: 7,
    gradeMax: 9,
    isActive: true,
    bands: [
      { label: 'Exceeding Expectation 1', code: 'EE1', minScore: 90, maxScore: 99, points: 8 },
      { label: 'Exceeding Expectation 2', code: 'EE2', minScore: 75, maxScore: 89, points: 7 },
      { label: 'Meeting Expectation 1', code: 'ME1', minScore: 58, maxScore: 74, points: 6 },
      { label: 'Meeting Expectation 2', code: 'ME2', minScore: 41, maxScore: 57, points: 5 },
      { label: 'Approaching Expectation 1', code: 'AE1', minScore: 31, maxScore: 40, points: 4 },
      { label: 'Approaching Expectation 2', code: 'AE2', minScore: 21, maxScore: 30, points: 3 },
      { label: 'Below Expectation 1', code: 'BE1', minScore: 11, maxScore: 20, points: 2 },
      { label: 'Below Expectation 2', code: 'BE2', minScore: 1, maxScore: 10, points: 1 },
    ],
  },
  {
    name: 'Upper Primary Grading System',
    description: 'Racefield grading standard for Grades 4-6',
    gradeMin: 4,
    gradeMax: 6,
    isActive: true,
    bands: [
      { label: 'Exceeding Expectation', code: 'EE', minScore: 75, maxScore: 99, points: 4 },
      { label: 'Meeting Expectation', code: 'ME', minScore: 50, maxScore: 74, points: 3 },
      { label: 'Approaching Expectation', code: 'AE', minScore: 35, maxScore: 49, points: 2 },
      { label: 'Below Expectation', code: 'BE', minScore: 1, maxScore: 34, points: 1 },
    ],
  },
  {
    name: 'Lower Primary Grading System',
    description: 'Racefield grading standard for Grades 1-3',
    gradeMin: 1,
    gradeMax: 3,
    isActive: true,
    bands: [
      { label: 'Exceeding Expectation', code: 'EE', minScore: 80, maxScore: 99, points: 4 },
      { label: 'Meeting Expectation', code: 'ME', minScore: 50, maxScore: 79, points: 3 },
      { label: 'Approaching Expectation', code: 'AE', minScore: 30, maxScore: 49, points: 2 },
      { label: 'Below Expectation', code: 'BE', minScore: 0, maxScore: 29, points: 1 },
    ],
  },
];

export function normaliseScore(
  score: number | null | undefined,
  maxScore: number | null | undefined
): number | null {
  if (score === null || score === undefined) return null;
  if (!Number.isFinite(score)) return null;
  if (score < 0) return null;
  if (maxScore === null || maxScore === undefined || maxScore <= 0) return null;
  if (score > maxScore) return null;
  return Math.round((score / maxScore) * 1000) / 10;
}

export function resolveRacefieldBand(
  normalisedScore: number | null,
  bands: RacefieldBand[]
): { bandId: string; bandLabel: string; bandCode: string; bandPoints: number | null } | null {
  if (normalisedScore === null || normalisedScore === undefined) return null;
  if (!Number.isFinite(normalisedScore)) return null;
  if (bands.length === 0) return null;

  for (const band of bands) {
    const withinFloor = normalisedScore >= band.minScore;
    const withinCeiling = normalisedScore <= band.maxScore;
    if (withinFloor && withinCeiling) {
      return {
        bandId: band.id,
        bandLabel: band.label,
        bandCode: band.code,
        bandPoints: band.points,
      };
    }
  }
  return null;
}

export async function resolveScaleForGradeLevel(
  schoolId: string,
  gradeLevel: string | null | undefined
): Promise<RacefieldScaleWithBands | null> {
  if (!gradeLevel) return null;

  const gradeNum = Number(gradeLevel);
  if (!Number.isFinite(gradeNum) || gradeNum <= 0) return null;

  const scale = await prisma.racefieldScale.findFirst({
    where: {
      schoolId,
      isActive: true,
      gradeMin: { lte: gradeNum },
      gradeMax: { gte: gradeNum },
    },
    orderBy: [{ isDefault: 'desc' }, { gradeMin: 'asc' }, { version: 'desc' }],
    include: { bands: { orderBy: { minScore: 'desc' } } },
  });

  if (!scale) return null;

  return {
    id: scale.id,
    schoolId: scale.schoolId,
    name: scale.name,
    description: scale.description,
    gradeMin: scale.gradeMin,
    gradeMax: scale.gradeMax,
    version: scale.version,
    isDefault: scale.isDefault,
    isActive: scale.isActive,
    effectiveFrom: scale.effectiveFrom,
    createdAt: scale.createdAt,
    updatedAt: scale.updatedAt,
    bands: scale.bands.map((b) => ({
      id: b.id,
      label: b.label,
      code: b.code,
      minScore: b.minScore,
      maxScore: b.maxScore,
      points: b.points,
    })),
  };
}

export async function loadBands(scaleId: string): Promise<RacefieldBand[]> {
  const bands = await prisma.racefieldBand.findMany({
    where: { scaleId },
    orderBy: { minScore: 'desc' },
  });
  return bands.map((b) => ({
    id: b.id,
    label: b.label,
    code: b.code,
    minScore: b.minScore,
    maxScore: b.maxScore,
    points: b.points,
  }));
}

export async function resolveRacefieldForScore({
  schoolId,
  score,
  maxScore,
  gradeLevel,
}: {
  schoolId: string;
  score: number | null | undefined;
  maxScore: number | null | undefined;
  gradeLevel: string | null | undefined;
}): Promise<ResolvedRacefield | null> {
  const normalisedScore = normaliseScore(score, maxScore);
  if (normalisedScore === null) return null;

  const scale = await resolveScaleForGradeLevel(schoolId, gradeLevel);
  if (!scale) return null;

  const band = resolveRacefieldBand(normalisedScore, scale.bands);
  if (!band) return null;

  return {
    scaleId: scale.id,
    scaleName: scale.name,
    scaleVersion: scale.version,
    bandId: band.bandId,
    bandLabel: band.bandLabel,
    bandCode: band.bandCode,
    bandPoints: band.bandPoints,
    normalisedScore,
  };
}

export function validateBands(
  bands: Array<{ minScore: number; maxScore: number; code: string }>
): void {
  if (bands.length === 0) {
    throw new ApiError(400, 'At least one band is required');
  }

  const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i];

    if (band.minScore < 0) {
      throw new ApiError(400, `Band ${band.code}: minScore cannot be negative`);
    }
    if (band.maxScore > 100) {
      throw new ApiError(400, `Band ${band.code}: maxScore cannot exceed 100`);
    }
    if (band.minScore > band.maxScore) {
      throw new ApiError(
        400,
        `Band ${band.code}: minScore (${band.minScore}) must not exceed maxScore (${band.maxScore})`
      );
    }

    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      if (band.maxScore >= next.minScore) {
        throw new ApiError(
          400,
          `Bands ${band.code} and ${next.code} overlap: ${band.minScore}-${band.maxScore} and ${next.minScore}-${next.maxScore}`
        );
      }
    }
  }

  const codes = new Set<string>();
  for (const band of bands) {
    if (codes.has(band.code)) {
      throw new ApiError(400, `Duplicate grade code "${band.code}" within a single grading system`);
    }
    codes.add(band.code);
  }
}

export async function seedRacefieldScales(schoolId: string) {
  const existing = await prisma.racefieldScale.findMany({
    where: { schoolId },
    select: { gradeMin: true },
  });
  const present = new Set(existing.map((s) => s.gradeMin));

  for (const scale of RACEFIELD_SEED_DATA) {
    if (present.has(scale.gradeMin)) continue;

    await prisma.racefieldScale.create({
      data: {
        schoolId,
        name: scale.name,
        description: scale.description,
        gradeMin: scale.gradeMin,
        gradeMax: scale.gradeMax,
        isActive: scale.isActive,
        bands: {
          create: scale.bands.map((b) => ({
            label: b.label,
            code: b.code,
            minScore: b.minScore,
            maxScore: b.maxScore,
            points: b.points,
          })),
        },
      },
    });

    present.add(scale.gradeMin);
  }

  const scales = await prisma.racefieldScale.findMany({
    where: { schoolId },
    include: { bands: { orderBy: { minScore: 'desc' } } },
    orderBy: [{ gradeMin: 'asc' }, { version: 'desc' }],
  });

  return scales.map((s) => ({
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
    bands: s.bands.map((b) => ({
      id: b.id,
      label: b.label,
      code: b.code,
      minScore: b.minScore,
      maxScore: b.maxScore,
      points: b.points,
    })),
  }));
}

export async function getActiveScales(schoolId: string): Promise<RacefieldScaleWithBands[]> {
  const scales = await prisma.racefieldScale.findMany({
    where: { schoolId, isActive: true },
    include: { bands: { orderBy: { minScore: 'desc' } } },
    orderBy: [{ gradeMin: 'asc' }, { version: 'desc' }],
  });

  return scales.map((s) => ({
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
    bands: s.bands.map((b) => ({
      id: b.id,
      label: b.label,
      code: b.code,
      minScore: b.minScore,
      maxScore: b.maxScore,
      points: b.points,
    })),
  }));
}

export async function getScalesByGrade(
  schoolId: string,
  gradeLevel: string
): Promise<RacefieldScaleWithBands[]> {
  const gradeNum = Number(gradeLevel);
  if (!Number.isFinite(gradeNum)) return [];

  const scales = await prisma.racefieldScale.findMany({
    where: {
      schoolId,
      gradeMin: { lte: gradeNum },
      gradeMax: { gte: gradeNum },
    },
    include: { bands: { orderBy: { minScore: 'desc' } } },
    orderBy: [{ isDefault: 'desc' }, { gradeMin: 'asc' }, { version: 'desc' }],
  });

  return scales.map((s) => ({
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
    bands: s.bands.map((b) => ({
      id: b.id,
      label: b.label,
      code: b.code,
      minScore: b.minScore,
      maxScore: b.maxScore,
      points: b.points,
    })),
  }));
}

export async function countGradesUsingScale(scaleId: string): Promise<number> {
  return prisma.grade.count({ where: { racefieldScaleId: scaleId } });
}
