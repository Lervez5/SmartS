import { Router } from "express";
import { AttendanceStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../infrastructure/database";
import { requireRole } from "../../middleware/rbac";
import { recordAuditLog } from "../audit-logs/service";

export const router: Router = Router();

const requireStaff = requireRole("super_admin", "school_admin", "teacher");

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

router.get("/today", async (req, res, next) => {
  try {
    const { start, end } = dayBounds();
    const records = await prisma.attendance.findMany({
      where: {
        date: { gte: start, lte: end },
        ...(req.user!.role === "student" ? { studentId: req.user!.id } : {}),
      },
      include: {
        class: { select: { id: true, name: true, subject: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(records);
  } catch (e) {
    next(e);
  }
});

router.get("/roster/:classId", requireStaff, async (req, res, next) => {
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
            student: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });
    if (!cls) {
      res.status(404).json({ error: { message: "Class not found" } });
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
      students: cls.enrollments.map((e) => {
        const student = e.student;
        if (!student) return null;
        const record = byStudent.get(student.id);
        return {
          ...student,
          attendance: record
            ? { id: record.id, status: record.status, note: record.note }
            : null,
        };
      }).filter(Boolean),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/mark", requireStaff, async (req, res, next) => {
  try {
    const payload = markSchema.parse(req.body);
    const { start, end, date } = dayBounds(payload.date);

    const cls = await prisma.class.findUnique({
      where: { id: payload.classId },
      select: { id: true, teacherId: true, name: true },
    });
    if (!cls) {
      res.status(404).json({ error: { message: "Class not found" } });
      return;
    }
    if (
      req.user!.role === "teacher" &&
      cls.teacherId &&
      cls.teacherId !== req.user!.id
    ) {
      res.status(403).json({ error: { message: "You do not teach this class" } });
      return;
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

    const saved = await prisma.$transaction(
      accepted.map((record) =>
        prisma.attendance.upsert({
          where: { id: `${payload.classId}:${record.studentId}:${date.toISOString().slice(0, 10)}` },
          update: { status: record.status, note: record.note, markedAt: new Date() },
          create: {
            id: `${payload.classId}:${record.studentId}:${date.toISOString().slice(0, 10)}`,
            classId: payload.classId,
            studentId: record.studentId,
            status: record.status,
            note: record.note,
            date,
            markedAt: new Date(),
          },
        })
      )
    ).catch(async () => {
      // The deterministic id is not a valid ObjectId on all records, so fall
      // back to manual find-then-write.
      const out = [];
      for (const record of accepted) {
        const existing = await prisma.attendance.findFirst({
          where: { classId: payload.classId, studentId: record.studentId, date: { gte: start, lte: end } },
        });
        out.push(
          existing
            ? await prisma.attendance.update({
                where: { id: existing.id },
                data: { status: record.status, note: record.note, markedAt: new Date() },
              })
            : await prisma.attendance.create({
                data: {
                  classId: payload.classId,
                  studentId: record.studentId,
                  status: record.status,
                  note: record.note,
                  date,
                  markedAt: new Date(),
                },
              })
        );
      }
      return out;
    });

    await recordAuditLog(
      req.user!.id,
      "MARK_ATTENDANCE",
      `Marked attendance for ${cls.name} (${saved.length} students)`
    );

    res.json({ saved: saved.length, rejected, date });
  } catch (e) {
    next(e);
  }
});

router.get("/history/me", async (req, res, next) => {
  try {
    const classId = req.query.classId ? String(req.query.classId) : undefined;
    const startDate = req.query.startDate ? new Date(String(req.query.startDate)) : undefined;
    const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : undefined;

    const records = await prisma.attendance.findMany({
      where: {
        studentId: req.user!.id,
        ...(classId ? { classId } : {}),
        ...(startDate || endDate
          ? { date: { ...(startDate ? { gte: startDate } : {}), ...(endDate ? { lte: endDate } : {}) } }
          : {}),
      },
      include: {
        class: { select: { id: true, name: true, subject: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;

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

router.get("/reports", requireStaff, async (req, res, next) => {
  try {
    const classId = req.query.classId ? String(req.query.classId) : undefined;
    const from = req.query.startDate ? new Date(String(req.query.startDate)) : new Date(Date.now() - 30 * 86400000);
    const to = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();

    const [byStatus, byClass, daily] = await Promise.all([
      prisma.attendance.groupBy({
        by: ["status"],
        where: { ...(classId ? { classId } : {}), date: { gte: from, lte: to } },
        _count: true,
      }),
      prisma.attendance.groupBy({
        by: ["classId"],
        where: { ...(classId ? { classId } : {}), date: { gte: from, lte: to } },
        _count: true,
      }),
      prisma.attendance.findMany({
        where: { ...(classId ? { classId } : {}), date: { gte: from, lte: to } },
        select: { date: true, status: true, studentId: true },
      }),
    ]);

    const classes = await prisma.class.findMany({
      where: { id: { in: byClass.map((c) => c.classId).filter(Boolean) as string[] } },
      select: { id: true, name: true },
    });
    const nameById = new Map(classes.map((c) => [c.id, c.name]));

    const present = byStatus.find((s) => s.status === "present")?._count ?? 0;
    const total = byStatus.reduce((s, x) => s + x._count, 0);

    res.json({
      range: { from, to },
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      byClass: byClass.map((c) => ({
        classId: c.classId,
        name: nameById.get(c.classId as string) ?? "Unassigned",
        count: c._count,
      })),
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      daily: daily.map((d) => ({ date: d.date, status: d.status })),
    });
  } catch (e) {
    next(e);
  }
});
