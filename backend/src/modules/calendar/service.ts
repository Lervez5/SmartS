import { PrismaClient } from "@prisma/client";
import { CreateCalendarEventDto, UpdateCalendarEventDto, CalendarQueryDto, EVENT_COLORS } from "./dto";

const prisma = new PrismaClient();
// Use (prisma as any) for new models not yet reflected in the cached TS client
const db = prisma as any;

export class CalendarService {

    async getEvents(userId: string, userRole: string, query: CalendarQueryDto) {
        let classIds: string[] = [];
        if (userRole === "student") {
            const enrollments = await db.enrollment.findMany({
                where: { studentId: userId },
                select: { classId: true },
            });
            classIds = enrollments.map((en: any) => en.classId);
        }

        const where: any = {
            OR: [
                { createdBy: userId },
                { visibility: "school" },
                { 
                    visibility: "class",
                    ...(userRole === "student" ? { classId: { in: classIds } } : {})
                },
            ],
        };

        if (query.start || query.end) {
            where.startDate = {};
            if (query.start) where.startDate.gte = new Date(query.start);
            if (query.end)   where.startDate.lte = new Date(query.end);
        }
        if (query.type)    where.type = query.type;
        if (query.classId) where.classId = query.classId;

        const events = await db.calendarEvent.findMany({
            where,
            orderBy: { startDate: "asc" },
            take: 200,
        });

        return events.map((e: any) => ({
            ...e,
            color: e.color ?? EVENT_COLORS[e.type as keyof typeof EVENT_COLORS] ?? "#22c55e",
        }));
    }

    async createEvent(userId: string, dto: CreateCalendarEventDto) {
        const color = dto.color ?? EVENT_COLORS[dto.type] ?? "#22c55e";
        const event = await db.calendarEvent.create({
            data: {
                title: dto.title,
                description: dto.description,
                type: dto.type,
                startDate: new Date(dto.startDate),
                endDate: dto.endDate ? new Date(dto.endDate) : null,
                allDay: dto.allDay ?? false,
                classId: dto.classId,
                assignmentId: dto.assignmentId,
                createdBy: userId,
                visibility: dto.visibility ?? "personal",
                color,
            },
        });

        if (dto.visibility === "school" || dto.visibility === "class") {
            await db.auditLog.create({
                data: {
                    userId,
                    action: "CREATE_SHARED_EVENT",
                    details: `Created ${dto.visibility} event: ${dto.title} (${event.id})`,
                }
            });
        }

        return event;
    }

    async updateEvent(userId: string, eventId: string, dto: UpdateCalendarEventDto) {
        const existing = await db.calendarEvent.findUnique({ where: { id: eventId } });
        if (!existing)                throw new Error("Event not found.");
        if (existing.createdBy !== userId) throw new Error("Access denied.");

        const data: any = { ...dto };
        if (dto.startDate) data.startDate = new Date(dto.startDate);
        if (dto.endDate)   data.endDate   = new Date(dto.endDate);
        delete data.classId;
        delete data.assignmentId;

        const event = await db.calendarEvent.update({ where: { id: eventId }, data });

        if (existing.visibility === "school" || existing.visibility === "class" || dto.visibility === "school" || dto.visibility === "class") {
            await db.auditLog.create({
                data: {
                    userId,
                    action: "UPDATE_SHARED_EVENT",
                    details: `Updated shared event: ${event.title} (${event.id})`,
                }
            });
        }

        return event;
    }

    async deleteEvent(userId: string, eventId: string) {
        const existing = await db.calendarEvent.findUnique({ where: { id: eventId } });
        if (!existing)                throw new Error("Event not found.");
        if (existing.createdBy !== userId) throw new Error("Access denied.");
        return db.calendarEvent.delete({ where: { id: eventId } });
    }

    async createAssignmentEvent(
        assignmentId: string, title: string, dueDate: Date, classId: string, teacherId: string
    ) {
        return db.calendarEvent.create({
            data: {
                title: `📋 ${title} — Due`,
                type: "assignment_due",
                startDate: dueDate,
                allDay: true,
                classId,
                assignmentId,
                createdBy: teacherId,
                visibility: "class",
                color: EVENT_COLORS.assignment_due,
            },
        });
    }

    async getToday(userId: string) {
        const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
        const dayEnd   = new Date(); dayEnd.setHours(23, 59, 59, 999);
        return db.calendarEvent.findMany({
            where: {
                startDate: { gte: dayStart, lte: dayEnd },
                OR: [
                    { createdBy: userId },
                    { visibility: "school" },
                    { visibility: "class" },
                ],
            },
            orderBy: { startDate: "asc" },
        });
    }
}

export const calendarService = new CalendarService();
