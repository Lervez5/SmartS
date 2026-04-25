import { Request, Response } from "express";
import { calendarService } from "./service";
import { CreateCalendarEventDto, UpdateCalendarEventDto, CalendarQueryDto } from "./dto";

export class CalendarController {

    async getEvents(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const query = req.query as CalendarQueryDto;
            const events = await calendarService.getEvents(user.id, user.role, query);
            return res.json(events);
        } catch (err: any) {
            return res.status(500).json({ message: err.message });
        }
    }

    async getToday(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const events = await calendarService.getToday(userId);
            return res.json(events);
        } catch (err: any) {
            return res.status(500).json({ message: err.message });
        }
    }

    async createEvent(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const dto = req.body as CreateCalendarEventDto;
            if (!dto.title || !dto.type || !dto.startDate) {
                return res.status(400).json({ message: "title, type, and startDate are required." });
            }
            // Guard: cannot create events in the past
            if (new Date(dto.startDate) < new Date()) {
                return res.status(400).json({ message: "Cannot create events for dates in the past." });
            }
            const event = await calendarService.createEvent(userId, dto);
            return res.status(201).json(event);
        } catch (err: any) {
            return res.status(400).json({ message: err.message });
        }
    }

    async updateEvent(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const { id } = req.params;
            const dto = req.body as UpdateCalendarEventDto;
            const event = await calendarService.updateEvent(userId, id, dto);
            return res.json(event);
        } catch (err: any) {
            return res.status(400).json({ message: err.message });
        }
    }

    async deleteEvent(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.id;
            const { id } = req.params;
            await calendarService.deleteEvent(userId, id);
            return res.json({ success: true });
        } catch (err: any) {
            return res.status(400).json({ message: err.message });
        }
    }
}

export const calendarController = new CalendarController();
