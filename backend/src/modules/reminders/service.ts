import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const db = prisma as any; // new models not yet reflected in cached TS client

export interface CreateReminderDto {
    title: string;
    description?: string;
    dueDate: string;
    priority?: "low" | "medium" | "high";
    repeat?: "none" | "daily" | "weekly" | "monthly";
    channel?: "in_app" | "email" | "both";
}

export class ReminderService {

    async list(userId: string) {
        return db.reminder.findMany({
            where: { userId, isDone: false },
            orderBy: { dueDate: "asc" },
        });
    }

    async listAll(userId: string) {
        return db.reminder.findMany({
            where: { userId },
            orderBy: [{ isDone: "asc" }, { dueDate: "asc" }],
        });
    }

    async create(userId: string, dto: CreateReminderDto) {
        return db.reminder.create({
            data: {
                userId,
                title: dto.title,
                description: dto.description,
                dueDate: new Date(dto.dueDate),
                priority: dto.priority ?? "medium",
                repeat: dto.repeat ?? "none",
                channel: dto.channel ?? "in_app",
            },
        });
    }

    async markDone(userId: string, id: string) {
        const r = await db.reminder.findUnique({ where: { id } });
        if (!r || r.userId !== userId) throw new Error("Not found");
        return db.reminder.update({ where: { id }, data: { isDone: true } });
    }

    async snooze(userId: string, id: string, minutes = 30) {
        const r = await db.reminder.findUnique({ where: { id } });
        if (!r || r.userId !== userId) throw new Error("Not found");
        const snoozedUntil = new Date(Date.now() + minutes * 60_000);
        return db.reminder.update({ where: { id }, data: { snoozedUntil } });
    }

    async delete(userId: string, id: string) {
        const r = await db.reminder.findUnique({ where: { id } });
        if (!r || r.userId !== userId) throw new Error("Not found");
        return db.reminder.delete({ where: { id } });
    }

    async getUpcoming(userId: string) {
        const now  = new Date();
        const soon = new Date(now.getTime() + 24 * 60 * 60_000);
        return db.reminder.findMany({
            where: { userId, isDone: false, dueDate: { gte: now, lte: soon } },
            orderBy: { dueDate: "asc" },
        });
    }
}

export const reminderService = new ReminderService();
