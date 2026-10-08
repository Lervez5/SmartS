/**
 * Racefield Grading Engine.
 *
 * Centralised score-to-grade resolution for the school's three Racefield
 * grading standards. The engine is the single source of truth: every
 * frontend, report, transcript and dashboard that needs a Racefield outcome
 * must call into it rather than implementing its own mapping.
 *
 * Resolution order
 * ----------------
 * 1. Normalise the raw score to 0-100 using the assessment maximum.
 * 2. Resolve the learner's actual grade/level from the enrollment/class.
 * 3. Select the Racefield scale whose grade range covers that level.
 * 4. Find the band whose inclusive boundaries contain the normalised score.
 *
 * Boundary behaviour
 * ------------------
 * A score sitting exactly on a boundary belongs to the band that includes
 * that value. The configured bands must therefore tile 0-100 without gaps
 * and without overlaps. The seed data shipped with the platform follows the
 * school's exact Racefield tables.
 */

import { prisma } from '../../infrastructure/database';
import { ApiError } from '../../shared/logger';

export interface RacefieldScale {
  id: string;
  name: string;
  gradeMin: number;
  gradeMax: number;
  isActive: boolean;
}

export interface RacefieldBand {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
}

export interface ResolvedRacefield {
  scaleId: string;
  scaleName: string;
  bandId: string;
  bandLabel: string;
  normalisedScore: number;
}

/**
 * Normalises a raw score to a 0-100 share of the assessment maximum.
 *
 * Returns null when the score cannot be compared across assessments, matching
 * the behaviour of the existing CBC grading engine.
 */
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

/**
 * Resolves the Racefield band for a normalised 0-100 score.
 *
 * Returns null when the score is absent or the band list is empty.
 */
export function resolveRacefieldBand(
  normalisedScore: number | null,
  bands: RacefieldBand[]
): { bandId: string; bandLabel: string } | null {
  if (normalisedScore === null || normalisedScore === undefined) return null;
  if (!Number.isFinite(normalisedScore)) return null;
  if (bands.length === 0) return null;

  for (const band of bands) {
    const withinFloor = normalisedScore >= band.minScore;
    const withinCeiling = normalisedScore <= band.maxScore;
    if (withinFloor && withinCeiling) {
      return { bandId: band.id, bandLabel: band.label };
    }
  }
  return null;
}

/**
 * Resolves the Racefield scale that applies to a learner's grade/level.
 *
 * A learner in Grade 7 falls in the Junior scale (7-9), Grade 5 in Upper
 * Primary (4-6) and Grade 2 in Lower Primary (1-3). Returns null when no
 * active scale covers the level.
 */
export async function resolveScaleForGradeLevel(
  schoolId: string,
  gradeLevel: string | null | undefined
): Promise<RacefieldScale | null> {
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
    orderBy: { gradeMin: 'asc' },
  });

  return scale;
}

/**
 * Loads the bands for one Racefield scale, ordered strongest first.
 */
export async function loadBands(scaleId: string): Promise<RacefieldBand[]> {
  const bands = await prisma.racefieldBand.findMany({
    where: { scaleId },
    orderBy: { minScore: 'desc' },
  });
  return bands.map((b) => ({
    id: b.id,
    label: b.label,
    minScore: b.minScore,
    maxScore: b.maxScore,
  }));
}

/**
 * The complete resolution: from raw score + max score + learner grade level
 * to the Racefield band that applies.
 *
 * Returns null when any prerequisite is missing or the score is out of range.
 */
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

  const bands = await loadBands(scale.id);
  const band = resolveRacefieldBand(normalisedScore, bands);
  if (!band) return null;

  return {
    scaleId: scale.id,
    scaleName: scale.name,
    bandId: band.bandId,
    bandLabel: band.bandLabel,
    normalisedScore,
  };
}

/**
 * Seeds the three Racefield scales for a school if it has none.
 *
 * Idempotent: existing scales for the same gradeMin are left alone.
 */
export async function seedRacefieldScales(schoolId: string) {
  const existing = await prisma.racefieldScale.findMany({
    where: { schoolId },
    select: { gradeMin: true },
  });
  const present = new Set(existing.map((s) => s.gradeMin));

  const scales = [
    {
      name: 'Junior Grading System',
      gradeMin: 7,
      gradeMax: 9,
      bands: [
        { label: 'Exceeding Expectation 1', minScore: 90, maxScore: 99 },
        { label: 'Exceeding Expectation 2', minScore: 75, maxScore: 89 },
        { label: 'Meeting Expectation 1', minScore: 58, maxScore: 74 },
        { label: 'Meeting Expectation 2', minScore: 41, maxScore: 57 },
        { label: 'Approaching Expectation 1', minScore: 31, maxScore: 40 },
        { label: 'Approaching Expectation 2', minScore: 21, maxScore: 30 },
        { label: 'Below Expectation 1', minScore: 11, maxScore: 20 },
        { label: 'Below Expectation 2', minScore: 1, maxScore: 10 },
      ],
    },
    {
      name: 'Upper Primary Grading System',
      gradeMin: 4,
      gradeMax: 6,
      bands: [
        { label: 'Exceeding Expectation', minScore: 75, maxScore: 99 },
        { label: 'Meeting Expectation', minScore: 50, maxScore: 74 },
        { label: 'Approaching Expectation', minScore: 35, maxScore: 49 },
        { label: 'Below Expectation', minScore: 1, maxScore: 34 },
      ],
    },
    {
      name: 'Lower Primary Grading System',
      gradeMin: 1,
      gradeMax: 3,
      bands: [
        { label: 'Exceeding Expectation', minScore: 80, maxScore: 99 },
        { label: 'Meeting Expectation', minScore: 50, maxScore: 79 },
        { label: 'Approaching Expectation', minScore: 30, maxScore: 49 },
        { label: 'Below Expectation', minScore: 0, maxScore: 29 },
      ],
    },
  ];

  for (const scale of scales) {
    if (present.has(scale.gradeMin)) continue;

    const created = await prisma.racefieldScale.create({
      data: {
        schoolId,
        name: scale.name,
        gradeMin: scale.gradeMin,
        gradeMax: scale.gradeMax,
        bands: {
          create: scale.bands.map((b) => ({
            label: b.label,
            minScore: b.minScore,
            maxScore: b.maxScore,
          })),
        },
      },
      include: { bands: true },
    });

    present.add(scale.gradeMin);
  }

  return prisma.racefieldScale.findMany({
    where: { schoolId },
    include: { bands: { orderBy: { minScore: 'desc' } } },
  });
}

/**
 * Returns all active Racefield scales for a school, with bands ordered
 * strongest first.
 */
export async function getActiveScales(schoolId: string) {
  return prisma.racefieldScale.findMany({
    where: { schoolId, isActive: true },
    include: { bands: { orderBy: { minScore: 'desc' } } },
    orderBy: { gradeMin: 'asc' },
  });
}
