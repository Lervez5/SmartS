import { Request, Response } from "express";
import { reminderService } from "./service";

export class ReminderController {
    async list(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const { all } = req.query;
            const data = all === "true"
                ? await reminderService.listAll(userId)
                : await reminderService.list(userId);
            return res.json(data);
        } catch (err: any) { return res.status(500).json({ message: err.message }); }
    }

    async create(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const dto = req.body;
            if (!dto.title || !dto.dueDate)
                return res.status(400).json({ message: "title and dueDate are required." });

            // Guard: cannot create reminders in the past
            if (new Date(dto.dueDate) < new Date()) {
                return res.status(400).json({ message: "Cannot create reminders for dates in the past." });
            }

            const reminder = await reminderService.create(userId, dto);
            return res.status(201).json(reminder);
        } catch (err: any) { return res.status(400).json({ message: err.message }); }
    }

    async markDone(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const reminder = await reminderService.markDone(userId, req.params.id);
            return res.json(reminder);
        } catch (err: any) { return res.status(400).json({ message: err.message }); }
    }

    async snooze(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const minutes = Number(req.body.minutes ?? 30);
            const reminder = await reminderService.snooze(userId, req.params.id, minutes);
            return res.json(reminder);
        } catch (err: any) { return res.status(400).json({ message: err.message }); }
    }

    async remove(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            await reminderService.delete(userId, req.params.id);
            return res.json({ success: true });
        } catch (err: any) { return res.status(400).json({ message: err.message }); }
    }

    async upcoming(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const data = await reminderService.getUpcoming(userId);
            return res.json(data);
        } catch (err: any) { return res.status(500).json({ message: err.message }); }
    }
}
export const reminderController = new ReminderController();
