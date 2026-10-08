/**
 * Attendance registers.
 *
 * A register is not a record of its own: it is the set of `Attendance` rows a
 * class has for one date, read against the learners enrolled in that class. This
 * module derives that view, which no existing route provided - `/today` returns
 * loose rows and `/roster/:classId` returns one day for one class, so nothing
 * could answer "which registers exist in this window".
 *
 * The learner population is the class enrolment, narrowed to a stream when one
 * is given. A stream is a subdivision of a class, not a class of its own, so
 * filtering by stream narrows the register rather than replacing it.
 *
 * Authorization reuses the class responsibility model: an administrative
 * capability sees every register in the school, a teacher sees only the classes
 * they are assigned to as class teacher or assistant class teacher.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { assignedClassIds } from '../classes/scope';

export const router: Router = Router();

router.use(requireSchoolScope());

const listSchema = z
  .object({
    classId: z.string().optional(),
    streamId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .refine(
    (value) =>
      !(value.startDate && value.endDate) || new Date(value.endDate) >= new Date(value.startDate),
    { message: 'End date must not be before the start date', path: ['endDate'] }
  );

/** How far back a list without dates reaches. */
const DEFAULT_WINDOW_DAYS = 30;

function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

router.get(
  '/registers',
  requirePermissions('attendance.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = listSchema.parse(req.query);
    const { schoolId } = schoolScopeOf(req);

    const to = query.endDate ? new Date(`${query.endDate}T23:59:59.999`) : new Date();
    const from = query.startDate
      ? new Date(`${query.startDate}T00:00:00.000`)
      : new Date(to.getTime() - DEFAULT_WINDOW_DAYS * 86400000);

    if (to < from) {
      throw new ApiError(400, 'End date must not be before the start date');
    }

    /*
     * A teacher sees only their assigned classes. Resolved from the assignments
     * rather than the role, so an unrelated teacher is not offered registers they
     * cannot open.
     */
    const mine = req.user!.role === 'SUPER_ADMIN' ? null : await assignedClassIds(req.user!.id);
    if (mine && mine.length === 0) {
      res.json({ registers: [], total: 0, scope: { assignedOnly: true } });
      return;
    }

    const classes = await prisma.class.findMany({
      where: {
        schoolId,
        ...(mine ? { id: { in: mine } } : {}),
        ...(query.classId ? { id: query.classId } : {}),
      },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        streams: {
          where: { status: 'active' },
          select: { id: true, name: true, code: true },
        },
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (classes.length === 0) {
      res.json({ registers: [], total: 0, scope: { assignedOnly: mine !== null } });
      return;
    }

    const classIds = classes.map((c) => c.id);

    // Every day in the window, so a day with no marks still shows as an
    // unmarked register rather than silently disappearing.
    const days: string[] = [];
    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      days.push(dayKey(d));
    }

    const records = await prisma.attendance.findMany({
      where: { classId: { in: classIds }, date: { gte: from, lte: to } },
      select: { classId: true, studentId: true, status: true, markedAt: true, date: true },
    });

    /*
     * The population for a register is the class enrolment, not a global learner
     * count, and narrowed to the stream when one is selected. Recorded per
     * (class, day) so the population reflects who was enrolled on that day rather
     * than who is enrolled now.
     */
    const enrolments = await prisma.enrollment.findMany({
      where: { classId: { in: classIds } },
      select: { classId: true, studentId: true, streamId: true },
    });
    const populationByClassDay = new Map<string, number>();
    for (const e of enrolments) {
      if (query.streamId && e.streamId !== query.streamId) continue;
      for (const day of days) {
        const key = `${e.classId}:${day}`;
        populationByClassDay.set(key, (populationByClassDay.get(key) ?? 0) + 1);
      }
    }

    const markedByClassDay = new Map<string, { count: number; latest: Date | null }>();
    for (const record of records) {
      const day = dayKey(record.date);
      // A stream filter narrows the register, so a mark outside it is not counted.
      if (query.streamId) {
        const stream = enrolments.find(
          (e) => e.classId === record.classId && e.studentId === record.studentId
        );
        if (stream?.streamId !== query.streamId) continue;
      }
      const key = `${record.classId}:${day}`;
      const entry = markedByClassDay.get(key) ?? { count: 0, latest: null };
      entry.count += 1;
      if (record.markedAt && (!entry.latest || record.markedAt > entry.latest)) {
        entry.latest = record.markedAt;
      }
      markedByClassDay.set(key, entry);
    }

    const registers = days
      .flatMap((day) =>
        classes.map((cls) => {
          const key = `${cls.id}:${day}`;
          const population = populationByClassDay.get(key) ?? 0;
          const marked = markedByClassDay.get(key) ?? { count: 0, latest: null };
          // A day the class had nobody enrolled for is not a register at all.
          if (population === 0) return null;

          return {
            classId: cls.id,
            className: cls.name,
            gradeLevel: cls.gradeLevel,
            streams: cls.streams,
            date: day,
            learners: population,
            markedCount: marked.count,
            lastMarkedAt: marked.latest,
            /*
             * The real state, derived rather than stored: nothing marked yet,
             * part of the register recorded, or the register complete. A
             * register is complete only when every enrolled learner has a mark.
             */
            state:
              marked.count === 0
                ? 'not_marked'
                : marked.count >= population
                  ? 'complete'
                  : 'part_marked',
          };
        })
      )
      .filter((row): row is NonNullable<typeof row> => row !== null)
      // Newest day first, and alphabetical by class within a day.
      .sort((a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className));

    res.json({
      registers: registers.slice(0, query.limit ?? 200),
      total: registers.length,
      scope: { assignedOnly: mine !== null, classCount: classes.length },
      window: { from: dayKey(from), to: dayKey(to) },
    });
  })
);

/**
 * Options for the register filters: the classes a caller may open, and the
 * streams inside the selected one. Streams belong to a class, so they are only
 * offered once a class is chosen.
 */
router.get(
  '/register-options',
  requirePermissions('attendance.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const mine = req.user!.role === 'SUPER_ADMIN' ? null : await assignedClassIds(req.user!.id);

    const classes = await prisma.class.findMany({
      where: {
        schoolId,
        ...(mine ? { id: { in: mine } } : {}),
        ...(req.query.classId ? { id: String(req.query.classId) } : {}),
      },
      select: {
        id: true,
        name: true,
        gradeLevel: true,
        streams: {
          where: { status: 'active' },
          select: { id: true, name: true, code: true },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ classes });
  })
);
