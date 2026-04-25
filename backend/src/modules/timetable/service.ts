import { PrismaClient } from "@prisma/client";
import { ScheduleRowDto } from "./dto";

const db = new PrismaClient() as any;

export class TimetableService {

    /** Bulk-create ClassSchedule records, matching classes by name */
    async bulkImport(schedules: ScheduleRowDto[]) {
        const imported: string[] = [];
        const errors: string[] = [];

        for (const row of schedules) {
            try {
                // Validate time format
                if (!/^\d{2}:\d{2}$/.test(row.startTime) || !/^\d{2}:\d{2}$/.test(row.endTime)) {
                    errors.push(`"${row.className}": invalid time format (expected HH:MM)`);
                    continue;
                }

                const cls = await db.class.findFirst({ where: { name: row.className } });
                if (!cls) {
                    errors.push(`Class not found: "${row.className}"`);
                    continue;
                }

                await db.classSchedule.create({
                    data: {
                        classId: cls.id,
                        dayOfWeek: Number(row.dayOfWeek),
                        startTime: row.startTime,
                        endTime: row.endTime,
                        room: row.room ?? null,
                        recurrence: row.recurrence ?? "weekly",
                        validFrom: new Date(row.validFrom),
                        validUntil: row.validUntil ? new Date(row.validUntil) : null,
                    },
                });

                imported.push(cls.id);
            } catch (e: any) {
                errors.push(`"${row.className}": ${e.message}`);
            }
        }

        return { imported: imported.length, errors };
    }

    /** Get all schedules for a specific class */
    async getByClass(classId: string) {
        return db.classSchedule.findMany({
            where: { classId },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        });
    }

    /** Get full weekly timetable for a teacher (all their classes) */
    async getTeacherTimetable(teacherId: string) {
        const classes = await db.class.findMany({
            where: { teacherId },
            include: {
                subject: { select: { name: true } },
                schedules: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
            },
        });

        // Flatten into a per-day map
        const byDay: Record<number, any[]> = {};
        for (const cls of classes) {
            for (const s of cls.schedules ?? []) {
                if (!byDay[s.dayOfWeek]) byDay[s.dayOfWeek] = [];
                byDay[s.dayOfWeek].push({
                    scheduleId: s.id,
                    classId: cls.id,
                    className: cls.name,
                    subject: cls.subject?.name,
                    startTime: s.startTime,
                    endTime: s.endTime,
                    room: s.room,
                    recurrence: s.recurrence,
                });
            }
        }
        return byDay;
    }

    /** Delete a single schedule entry */
    async deleteSchedule(scheduleId: string) {
        return db.classSchedule.delete({ where: { id: scheduleId } });
    }
}

export const timetableService = new TimetableService();
