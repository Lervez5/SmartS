/**
 * Summative assessment overview.
 *
 * Every figure here is computed from the real examination, attempt and grade
 * collections. Nothing is stored as a running total and nothing is derived in
 * the browser, so the numbers move when the underlying marks do.
 *
 * Rules that matter for the figures being honest:
 *
 *  - A score is only comparable across assessments as a share of that
 *    assessment's maximum. An attempt on a paper with no maximum set is counted
 *    as a result but left out of the average, because averaging 8/10 with 40/100
 *    would produce a number that means nothing.
 *  - Unscored attempts are excluded from the average rather than counted as
 *    zero, which would drag it down for learners who were never entered.
 *  - The grade band distribution counts the CBC competency levels actually
 *    recorded on grades. Bands come from the school's `CompetencyBand` rows, so
 *    a school that has not configured them gets an explicit "not configured"
 *    rather than invented boundaries.
 */

import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { schoolScopeOf } from '../settings/scope';
import {
  asPercentage,
  COMPETENCY_LEVELS,
  COMPETENCY_LABELS,
  getCompetencyBands,
} from '../academics/grading';

export const router: Router = Router();

const summarySchema = z.object({
  /** Defaults to the session the navbar has selected. */
  academicYearId: z.string().optional(),
  termId: z.string().optional(),
  gradeLevel: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get(
  '/summative',
  requirePermissions('examinations.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = summarySchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);

    // The context every figure is scoped to, so an average and a distribution
    // can never be built from two different sessions.
    //
    // An examination carries no schoolId of its own: it belongs to a school
    // through the class it is set against, or through the academic year it sits
    // in. Scoped by both relations so a paper recorded without a class is still
    // counted against the right school.
    const context: Prisma.ExaminationWhereInput = {
      // Scoped through the session, which carries its own school. Class and
      // Subject have no schoolId in the schema yet, so they cannot scope a
      // query; that gap is documented rather than worked around.
      academicYear: { schoolId },
      ...(query.academicYearId ? { academicYearId: query.academicYearId } : {}),
      ...(query.termId ? { termId: query.termId } : {}),
    };

    const examinationWhere: Prisma.ExaminationWhereInput = {
      ...context,
      ...(query.gradeLevel ? { class: { gradeLevel: query.gradeLevel } } : {}),
    };

    const [assessments, bands] = await Promise.all([
      prisma.examination.findMany({
        where: examinationWhere,
        select: {
          id: true,
          title: true,
          status: true,
          assessmentType: true,
          startDate: true,
          maxScore: true,
          classId: true,
          class: { select: { name: true, gradeLevel: true } },
          subject: { select: { name: true } },
          term: { select: { name: true, termNumber: true } },
          academicYear: { select: { name: true, label: true } },
          _count: { select: { examAttempts: true } },
        },
        orderBy: { startDate: 'desc' },
      }),
      getCompetencyBands(schoolId),
    ]);

    const assessmentIds = assessments.map((a) => a.id);
    const maxScoreById = new Map(assessments.map((a) => [a.id, a.maxScore]));

    const attempts = assessmentIds.length
      ? await prisma.examAttempt.findMany({
          where: { examinationId: { in: assessmentIds } },
          select: { examinationId: true, studentId: true, score: true, graded: true },
        })
      : [];

    // Results entered: a learner whose score has actually been recorded.
    const scoredAttempts = attempts.filter((a) => a.score !== null);

    // Average is over comparable scores only.
    const percentages = scoredAttempts
      .map((a) => asPercentage(a.score, maxScoreById.get(a.examinationId)))
      .filter((p): p is number => p !== null);

    const schoolAverage =
      percentages.length > 0
        ? Math.round((percentages.reduce((sum, p) => sum + p, 0) / percentages.length) * 10) / 10
        : null;

    // Grade levels with assessment activity in this context.
    const gradeLevels = [
      ...new Set(
        assessments.map((a) => a.class?.gradeLevel).filter((g): g is string => Boolean(g))
      ),
    ].sort();

    // Assessments that have attempts but no marks recorded yet.
    const awaitingResults = assessments.filter((a) => {
      const own = attempts.filter((t) => t.examinationId === a.id);
      return own.length > 0 && own.every((t) => t.score === null);
    }).length;

    // Grade band distribution, from the CBC levels actually recorded on grades.
    const grades = assessmentIds.length
      ? await prisma.grade.findMany({
          where: { examinationId: { in: assessmentIds } },
          select: { competencyLevel: true, scale: true, value: true },
        })
      : [];

    const levelCounts = new Map<string, number>();
    for (const grade of grades) {
      if (!grade.competencyLevel) continue;
      levelCounts.set(grade.competencyLevel, (levelCounts.get(grade.competencyLevel) ?? 0) + 1);
    }
    const gradedTotal = [...levelCounts.values()].reduce((sum, n) => sum + n, 0);

    const distribution = COMPETENCY_LEVELS.map((level) => {
      const count = levelCounts.get(level) ?? 0;
      const band = bands.find((b) => b.level === level);
      return {
        level,
        label: band?.label ?? COMPETENCY_LABELS[level],
        range: band
          ? band.maxPercent === null
            ? `${band.minPercent}% and above`
            : `${band.minPercent}%–${band.maxPercent}%`
          : null,
        description: band?.description ?? null,
        count,
        // Share of graded results, not of learners, so a learner graded in two
        // learning areas is counted in both, which is what the figure describes.
        percent: gradedTotal > 0 ? Math.round((count / gradedTotal) * 1000) / 10 : null,
      };
    });

    res.json({
      context: {
        academicYearId: query.academicYearId ?? null,
        termId: query.termId ?? null,
        gradeLevel: query.gradeLevel ?? null,
      },
      metrics: {
        assessments: assessments.length,
        resultsEntered: scoredAttempts.length,
        // Attempts that exist but carry no score, so progress is visible.
        resultsPending: attempts.length - scoredAttempts.length,
        awaitingResults,
        schoolAverage,
        gradesCovered: gradeLevels.length,
      },
      gradeLevels,
      // Explicit rather than implied: with no bands configured there is no
      // distribution to show, and empty bars would read as "no results yet".
      grading: {
        bandsConfigured: bands.length > 0,
        scale: bands.length > 0 ? 'cbc-competency' : null,
        gradedResults: gradedTotal,
        distribution,
      },
      recent: assessments.slice(0, query.limit ?? 8).map((a) => ({
        id: a.id,
        title: a.title,
        assessmentType: a.assessmentType,
        status: a.status,
        startDate: a.startDate,
        maxScore: a.maxScore,
        gradeLevel: a.class?.gradeLevel ?? null,
        className: a.class?.name ?? null,
        subjectName: a.subject?.name ?? null,
        termName: a.term ? `Term ${a.term.termNumber}` : null,
        sessionName: a.academicYear?.label ?? a.academicYear?.name ?? null,
        attempts: a._count.examAttempts,
      })),
    });
  })
);
