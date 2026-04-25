import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

export const timetableRouter = Router();
const db = new PrismaClient() as any;

interface ScheduleRow {
    className: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
    recurrence?: string;
    validFrom: string;
    validUntil?: string;
}

timetableRouter.post("/bulk", async (req: Request, res: Response) => {
    try {
        const { schedules } = req.body as { schedules: ScheduleRow[] };
        if (!Array.isArray(schedules) || schedules.length === 0)
            return res.status(400).json({ message: "No schedules provided." });

        const imported: number[] = [];
        const errors: string[] = [];

        for (const row of schedules) {
            try {
                // Find class by name
                const cls = await db.class.findFirst({ where: { name: row.className } });
                if (!cls) { errors.push(`Class not found: "${row.className}"`); continue; }

                await db.classSchedule.create({
                    data: {
                        classId: cls.id,
                        dayOfWeek: Number(row.dayOfWeek),
                        startTime: row.startTime,
                        endTime: row.endTime,
                        room: row.room || null,
                        recurrence: row.recurrence || "weekly",
                        validFrom: new Date(row.validFrom),
                        validUntil: row.validUntil ? new Date(row.validUntil) : null,
                    },
                });
                imported.push(1);
            } catch (e: any) {
                errors.push(`Row "${row.className}": ${e.message}`);
            }
        }

        return res.json({ imported: imported.length, errors });
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
});

// GET timetable for a class
timetableRouter.get("/class/:classId", async (req: Request, res: Response) => {
    try {
        const schedules = await db.classSchedule.findMany({
            where: { classId: req.params.classId },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        });
        return res.json(schedules);
    } catch (err: any) {
        return res.status(500).json({ message: err.message });
    }
});
