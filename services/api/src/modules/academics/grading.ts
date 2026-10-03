/**
 * CBC competency grading.
 *
 * A summative score on its own does not say whether a learner met, approached
 * or fell below the expectation for the outcome. That judgement is expressed by
 * the CBC competency levels - EE, ME, AE and BE - and the boundary between two
 * levels is the school's own policy rather than a constant, so it lives in
 * `CompetencyBand` and is resolved here.
 *
 * Both the marks-entry path and the overview use this module, so a level shown on
 * a report is the same level the mark was given, computed the same way.
 */

import { CompetencyLevel, GradeScale } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { ApiError } from '../../shared/logger';

/** The curriculum's levels, strongest first. Used only to seed and to order. */
export const COMPETENCY_LEVELS: CompetencyLevel[] = [
  CompetencyLevel.EE,
  CompetencyLevel.ME,
  CompetencyLevel.AE,
  CompetencyLevel.BE,
];

export const COMPETENCY_LABELS: Record<CompetencyLevel, string> = {
  [CompetencyLevel.EE]: 'Exceeds Expectation',
  [CompetencyLevel.ME]: 'Meets Expectation',
  [CompetencyLevel.AE]: 'Approaches Expectation',
  [CompetencyLevel.BE]: 'Below Expectation',
};

/**
 * The levels as the curriculum names them, with the bands a school starts from.
 *
 * These are the default cut-offs a school is given, not a rule baked into the
 * platform: they are written as `CompetencyBand` rows and can be changed per
 * school from the grading configuration.
 */
export const DEFAULT_BANDS: Array<{
  level: CompetencyLevel;
  minPercent: number;
  maxPercent: number | null;
  description: string;
}> = [
  {
    level: CompetencyLevel.EE,
    minPercent: 75,
    maxPercent: null,
    description: 'Scores beyond the expected range for the outcome.',
  },
  {
    level: CompetencyLevel.ME,
    minPercent: 50,
    maxPercent: 74,
    description: 'Meets the expectation for the outcome.',
  },
  {
    level: CompetencyLevel.AE,
    minPercent: 25,
    maxPercent: 49,
    description: 'Approaches the expectation; needs further support.',
  },
  {
    level: CompetencyLevel.BE,
    minPercent: 0,
    maxPercent: 24,
    description: 'Below the expectation at this stage.',
  },
];

/**
 * Creates the school's default bands if it has none.
 *
 * Idempotent and non-destructive: an existing band for a level is left alone, so
 * a school's configured cut-offs are never reset by a seed.
 */
export async function ensureCompetencyBands(schoolId: string) {
  const existing = await prisma.competencyBand.findMany({ where: { schoolId } });
  const present = new Set(existing.map((b) => b.level));

  const missing = DEFAULT_BANDS.filter((band) => !present.has(band.level));
  if (missing.length === 0) return existing;

  await prisma.competencyBand.createMany({
    data: missing.map((band) => ({
      schoolId,
      level: band.level,
      label: COMPETENCY_LABELS[band.level],
      minPercent: band.minPercent,
      maxPercent: band.maxPercent,
      description: band.description,
    })),
  });

  return prisma.competencyBand.findMany({ where: { schoolId }, orderBy: { minPercent: 'desc' } });
}

/** The school's bands, strongest first. */
export async function getCompetencyBands(schoolId: string) {
  const bands = await prisma.competencyBand.findMany({
    where: { schoolId },
    orderBy: { minPercent: 'desc' },
  });
  return bands;
}

export interface ResolvedBand {
  level: CompetencyLevel;
  bandId: string;
  label: string;
}

/**
 * Resolves a score to a competency level using the school's own bands.
 *
 * `percent` is the score as a share of the assessment maximum, so the same band
 * table applies to a 20-point paper and a 100-point one. Returns null when the
 * score is absent, negative, or cannot be expressed as a percentage - an
 * unplaceable score is left unclassified rather than forced into a band that
 * would overstate what the mark shows.
 */
export function resolveBand(
  percent: number | null | undefined,
  bands: Array<{
    id: string;
    level: CompetencyLevel;
    label: string;
    minPercent: number;
    maxPercent: number | null;
  }>
): ResolvedBand | null {
  if (percent === null || percent === undefined) return null;
  if (!Number.isFinite(percent) || percent < 0) return null;
  if (bands.length === 0) return null;

  for (const band of bands) {
    const withinFloor = percent >= band.minPercent;
    const withinCeiling = band.maxPercent === null || percent <= band.maxPercent;
    if (withinFloor && withinCeiling) {
      return { level: band.level, bandId: band.id, label: band.label };
    }
  }
  return null;
}

/**
 * Expresses a raw score as a share of the assessment maximum.
 *
 * Returns null when the assessment has no maximum, because a bare score cannot
 * be compared across papers: 8 out of 10 and 40 out of 100 are not comparable,
 * and averaging them as if they were would produce a misleading figure.
 */
export function asPercentage(
  score: number | null | undefined,
  maxScore: number | null | undefined
): number | null {
  if (score === null || score === undefined) return null;
  if (maxScore === null || maxScore === undefined || maxScore <= 0) return null;
  if (!Number.isFinite(score)) return null;
  return (score / maxScore) * 100;
}

/**
 * Resolves the competency level for one score, against the school's bands.
 *
 * Used by marks entry so a level is never typed by hand: it is always derived
 * from the mark and the school's configured boundaries, and stored alongside it
 * so a report can be read without recomputing against bands that may since
 * have changed.
 */
export async function resolveCompetencyForScore(
  schoolId: string,
  score: number | null | undefined,
  maxScore: number | null | undefined
): Promise<ResolvedBand | null> {
  const percent = asPercentage(score, maxScore);
  if (percent === null) return null;

  const bands = await getCompetencyBands(schoolId);
  return resolveBand(percent, bands);
}

/** Exposed for the settings screen, which shows the school's grading policy. */
export function describeBands(
  bands: Array<{
    level: CompetencyLevel;
    label: string;
    minPercent: number;
    maxPercent: number | null;
    description: string | null;
  }>
) {
  return bands.map((band) => ({
    level: band.level,
    label: band.label,
    range:
      band.maxPercent === null
        ? `${band.minPercent}% and above`
        : `${band.minPercent}% – ${band.maxPercent}%`,
    description: band.description,
  }));
}

/** Rejects an attempt to grade a score against no policy at all. */
export async function assertGradingPolicyExists(schoolId: string): Promise<void> {
  const bands = await getCompetencyBands(schoolId);
  if (bands.length === 0) {
    throw new ApiError(
      409,
      'This school has no competency bands configured, so marks cannot be graded. Add the CBC bands under School Configuration first.'
    );
  }
}

export { CompetencyLevel, GradeScale };
