import { Router } from 'express';
import { AttendanceStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database';
import { requireRole, requirePermissions } from '../../middleware/rbac';
import { resolveClassResponsibility } from '../classes/scope';
import { recordAuditLog } from '../audit-logs/service';

export const router: Router = Router();

const requireMark = requirePermissions('attendance.mark');
const requireView = requirePermissions('attendance.view');

const markSchema = z.object({
  classId: z.string().min(1),
  date: z.string().optional(),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.nativeEnum(AttendanceStatus),
        note: z.string().optional(),
      })
    )
    .min(1),
});

function dayBounds(date?: string) {
  const base = date ? new Date(date) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end, date: start };
}

router.get('/today', async (req, res, next) => {
  try {
    const { start, end } = dayBounds();
    const records = await prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(req.user!.role === 'STUDENT' ? { studentId: req.user!.id } : {}),
      },
      include: {
        class: {
          select: { id: true, name: true, subject: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(records);
  } catch (e) {
    next(e);
  }
});

router.get('/roster/:classId', requireView, async (req, res, next) => {
  try {
    const date = req.query.date ? String(req.query.date) : undefined;
    const { start, end } = dayBounds(date);

    const cls = await prisma.class.findUnique({
      where: { id: req.params.classId },
      select: {
        id: true,
        name: true,
        subject: { select: { id: true, name: true } },
        enrollments: {
          select: {
            student: {
              select: { id: true, name: true, email: true, avatar: true },
            },
          },
        },
      },
    });
    if (!cls) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }

    const marked = await prisma.attendance.findMany({
      where: { classId: cls.id, date: { gte: start, lte: end } },
      select: { id: true, studentId: true, status: true, note: true },
    });
    const byStudent = new Map(marked.map((m) => [m.studentId, m]));

    res.json({
      class: { id: cls.id, name: cls.name, subject: cls.subject },
      date: start,
      students: cls.enrollments
        .map((e) => {
          const student = e.student;
          if (!student) return null;
          const record = byStudent.get(student.id);
          return {
            ...student,
            attendance: record ? { id: record.id, status: record.status, note: record.note } : null,
          };
        })
        .filter(Boolean),
    });
  } catch (e) {
    next(e);
  }
});

router.post('/mark', requireMark, async (req, res, next) => {
  try {
    const payload = markSchema.parse(req.body);
    const { start, end, date } = dayBounds(payload.date);

    const cls = await prisma.class.findUnique({
      where: { id: payload.classId },
      select: { id: true, name: true },
    });
    if (!cls) {
      res.status(404).json({ error: { message: 'Class not found' } });
      return;
    }

    /*
     * Marking is scoped to an assignment, not to a role.
     *
     * The previous check was `role === 'TEACHER' && cls.teacherId && ...`, which
     * did three wrong things: it keyed on the role rather than on an
     * assignment, it ignored assistant class teachers entirely, and it failed
     * open whenever a class had no main teacher set, letting any teacher mark
     * any class. An administrative capability opens any class in the school; a
     * teacher needs the class teacher or assistant class teacher assignment.
     */
    if (req.user!.role !== 'SUPER_ADMIN') {
      const responsibility = await resolveClassResponsibility(req.user!.id, cls.id);
      if (!responsibility) {
        res.status(404).json({ error: { message: 'Class not found' } });
        return;
      }
      if (!responsibility.hasAccess) {
        res.status(403).json({
          error: {
            message:
              'You are not assigned to this class. Marking attendance requires the class teacher or assistant class teacher assignment, not the TEACHER role.',
          },
        });
        return;
      }
      if (!responsibility.canManage) {
        res.status(403).json({
          error: {
            message:
              'You are an assistant class teacher on this class with view-only rights, so you cannot record attendance for it.',
          },
        });
        return;
      }
    }

    const enrolled = await prisma.enrollment.findMany({
      where: { classId: payload.classId },
      select: { studentId: true },
    });
    const allowed = new Set(enrolled.map((e) => e.studentId));
    const rejected = payload.records
      .filter((r) => !allowed.has(r.studentId))
      .map((r) => r.studentId);

    const accepted = payload.records.filter((r) => allowed.has(r.studentId));

    /*
     * Batched rather than per learner.
     *
     * A class can hold fifty learners or more, and the previous path attempted a
     * composite-id upsert that cannot succeed here, then fell back to a
     * read-then-write loop: roughly a hundred queries for one register. This
     * reads the day's existing marks once, updates what changed and inserts the
     * rest, so a full roster is three round trips.
     */
    const markedAt = new Date();
    const existing = await prisma.attendance.findMany({
      where: { classId: payload.classId, date: { gte: start, lte: end } },
      select: { id: true, studentId: true },
    });
    const existingByStudent = new Map(existing.map((row) => [row.studentId, row.id]));

    const toCreate = accepted.filter((record) => !existingByStudent.has(record.studentId));
    const toUpdate = accepted.filter((record) => existingByStudent.has(record.studentId));

    const saved = await prisma.$transaction(async (tx) => {
      await Promise.all(
        toUpdate.map((record) =>
          tx.attendance.update({
            where: { id: existingByStudent.get(record.studentId)! },
            data: { status: record.status, note: record.note, markedAt },
          })
        )
      );

      if (toCreate.length > 0) {
        await tx.attendance.createMany({
          data: toCreate.map((record) => ({
            classId: payload.classId,
            studentId: record.studentId,
            status: record.status,
            note: record.note,
            date,
            markedAt,
          })),
        });
      }

      return accepted.length;
    });

    await recordAuditLog(
      req.user!.id,
      'MARK_ATTENDANCE',
      `Marked attendance for ${cls.name} (${saved} learners)`
    );

    res.json({ saved, rejected, date });
  } catch (e) {
    next(e);
  }
});

router.get('/history/me', async (req, res, next) => {
  try {
    const classId = req.query.classId ? String(req.query.classId) : undefined;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

    const records = await prisma.attendance.findMany({
      where: {
        studentId: req.user!.id,
        ...(classId ? { classId } : {}),
        ...(startDate || endDate
          ? {
              date: {
                ...(startDate ? { gte: startDate } : {}),
                ...(endDate ? { lte: endDate } : {}),
              },
            }
          : {}),
      },
      include: {
        class: {
          select: { id: true, name: true, subject: { select: { name: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === 'present').length;
    const absent = records.filter((r) => r.status === 'absent').length;

    res.json({
      records,
      stats: {
        total,
        present,
        absent,
        percentage: total > 0 ? Math.round((present / total) * 100) : 100,
      },
    });
  } catch (e) {
    next(e);
  }
});

router.get('/reports', requireView, async (req, res, next) => {
  try {
    const classId = req.query.classId ? String(req.query.classId) : undefined;
    const from = req.query.startDate
      ? new Date(String(req.query.startDate))
      : new Date(Date.now() - 30 * 86400000);
    const to = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const [byStatus, byClass, daily] = await Promise.all([
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          ...(classId ? { classId } : {}),
          date: { gte: from, lte: to },
        },
        _count: true,
      }),
      prisma.attendance.groupBy({
        by: ['classId'],
        where: {
          ...(classId ? { classId } : {}),
          date: { gte: from, lte: to },
        },
        _count: true,
      }),
      prisma.attendance.findMany({
        where: {
          ...(classId ? { classId } : {}),
          date: { gte: from, lte: to },
        },
        select: { date: true, status: true, studentId: true },
      }),
    ]);

    const classes = await prisma.class.findMany({
      where: {
        id: { in: byClass.map((c) => c.classId).filter(Boolean) as string[] },
      },
      select: { id: true, name: true },
    });
    const nameById = new Map(classes.map((c) => [c.id, c.name]));

    const present = byStatus.find((s) => s.status === 'present')?._count ?? 0;
    const total = byStatus.reduce((s, x) => s + x._count, 0);

    res.json({
      range: { from, to },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byClass: byClass.map((c) => ({
        classId: c.classId,
        name: nameById.get(c.classId as string) ?? 'Unassigned',
        count: c._count,
      })),
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      daily: daily.map((d) => ({ date: d.date, status: d.status })),
    });
  } catch (e) {
    next(e);
  }
});
