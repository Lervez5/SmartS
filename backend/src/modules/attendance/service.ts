import { PrismaClient } from "@prisma/client";
import { MarkAttendanceDto, AttendanceQueryDto, VALID_STATUSES } from "./dto";

const prisma = new PrismaClient();


export class AttendanceService {

    /** Get the roster for a class on a specific date, merging any existing attendance records */
    async getRoster(classId: string, date: string) {
        const targetDate = new Date(date);
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Get enrolled students
        const enrollments = await prisma.enrollment.findMany({
            where: { classId },
            include: {
                student: {
                    select: { id: true, name: true, firstName: true, lastName: true, email: true, avatar: true }
                }
            }
        });

        // Get any existing attendance for that day
        const existing = await prisma.attendance.findMany({
            where: {
                classId,
                date: { gte: dayStart, lte: dayEnd }
            }
        });

        const existingMap = new Map(existing.map(a => [a.studentId, a]));

        return enrollments.map(e => ({
            student: e.student,
            attendance: existingMap.get(e.studentId) ?? null,
        }));
    }

    /** Bulk mark / upsert attendance records for a class session */
    async markAttendance(teacherId: string, dto: MarkAttendanceDto) {
        const { classId, date, records, isDraft } = dto;

        // Validate class belongs to teacher
        const cls = await prisma.class.findFirst({ where: { id: classId, teacherId } });
        if (!cls) throw new Error("Class not found or access denied.");

        // Validate statuses
        for (const r of records) {
            if (!VALID_STATUSES.includes(r.status)) {
                throw new Error(`Invalid status: ${r.status}`);
            }
        }

        const targetDate = new Date(date);
        const dayStart = new Date(targetDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDate);
        dayEnd.setHours(23, 59, 59, 999);

        const now = new Date();
        const submittedAt = isDraft ? null : now;


        // MongoDB doesn't support composite unique constraints — use manual find-then-upsert

        const results = await Promise.all(
            records.map(async r => {
                const existing = await prisma.attendance.findFirst({
                    where: {
                        classId,
                        studentId: r.studentId,
                        date: { gte: dayStart, lte: dayEnd }
                    }
                });

                if (existing) {
                    return prisma.attendance.update({
                        where: { id: existing.id },
                        data: {
                            status: r.status,
                            note: r.note ?? (existing as any).note,
                            markedAt: now,
                            submittedAt,
                        } as any
                    });
                } else {
                    return prisma.attendance.create({
                        data: {
                            classId,
                            studentId: r.studentId,
                            status: r.status,
                            note: r.note,
                            date: targetDate,
                            markedAt: now,
                            submittedAt,
                        } as any
                    });
                }
            })
        );

        return { count: results.length, isDraft: !!isDraft };
    }

    /** Get a student's attendance history */
    async getStudentHistory(studentId: string, query: AttendanceQueryDto) {
        const where: any = { studentId };

        if (query.classId) where.classId = query.classId;
        if (query.status) where.status = query.status;
        if (query.startDate || query.endDate) {
            where.date = {};
            if (query.startDate) where.date.gte = new Date(query.startDate);
            if (query.endDate) where.date.lte = new Date(query.endDate);
        }

        const records = await prisma.attendance.findMany({
            where,
            include: {
                class: { select: { id: true, name: true, subject: { select: { name: true } } } },
            },
            orderBy: { date: "desc" },
            take: 100,
        });

        // Compute summary stats
        const total = records.length;
        const present = records.filter(r => r.status === "present" || r.status === "late").length;
        const absent = records.filter(r => r.status === "absent").length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

        return { records, stats: { total, present, absent, percentage } };
    }

    /** Teacher's classes for today */
    async getTodayClasses(teacherId: string) {
        const today = new Date();
        const dayStart = new Date(today);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(today);
        dayEnd.setHours(23, 59, 59, 999);

        const classes = await (prisma.class.findMany as any)({
            where: { teacherId },
            include: {
                subject: { select: { name: true } },
                enrollments: { select: { studentId: true } },
                attendance: {
                    where: { date: { gte: dayStart, lte: dayEnd } },
                    select: { studentId: true, status: true, submittedAt: true }
                }
            }
        }) as any[];

        return classes.map((c: any) => ({
            id: c.id,
            name: c.name,
            subject: c.subject?.name ?? c.subjectId,
            schedule: c.schedule,
            totalStudents: c.enrollments?.length ?? 0,
            markedCount: c.attendance?.length ?? 0,
            isSubmitted: (c.attendance ?? []).some((a: any) => a.submittedAt !== null),
        }));
    }

    /** School-wide attendance reports for admin */
    async getReports(query: AttendanceQueryDto) {
        const where: any = {};
        if (query.classId) where.classId = query.classId;
        if (query.date) {
            const d = new Date(query.date);
            const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
            where.date = { gte: dayStart, lte: dayEnd };
        } else if (query.startDate || query.endDate) {
            where.date = {};
            if (query.startDate) where.date.gte = new Date(query.startDate);
            if (query.endDate) where.date.lte = new Date(query.endDate);
        }

        const records = await prisma.attendance.findMany({
            where,
            include: {
                student: { select: { id: true, name: true, email: true } },
                class: { select: { id: true, name: true, subject: { select: { name: true } } } },
            },
            orderBy: { date: "desc" },
            take: 500,
        });

        const total = records.length;
        const byStatus: Record<string, number> = {};
        for (const r of records) {
            byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        }

        const attendanceRate = total > 0
            ? Math.round(((byStatus.present ?? 0) + (byStatus.late ?? 0)) / total * 100)
            : 100;

        return { records, stats: { total, byStatus, attendanceRate } };
    }
}

export const attendanceService = new AttendanceService();
