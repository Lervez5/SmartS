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
            const user = (req as any).user;
            const dto = req.body as CreateCalendarEventDto;
            
            if (!dto.title || !dto.type || !dto.startDate) {
                return res.status(400).json({ message: "title, type, and startDate are required." });
            }

            // Role check for shared events
            const isShared = dto.visibility === "class" || dto.visibility === "school";
            const canShare = ["super_admin", "school_admin", "teacher"].includes(user.role);
            
            if (isShared && !canShare) {
                return res.status(403).json({ message: "Only administrators and teachers can create shared events." });
            }

            // Guard: cannot create events in the past
            if (new Date(dto.startDate) < new Date()) {
                return res.status(400).json({ message: "Cannot create events for dates in the past." });
            }

            const event = await calendarService.createEvent(user.id, dto);
            return res.status(201).json(event);
        } catch (err: any) {
            return res.status(400).json({ message: err.message });
        }
    }

    async updateEvent(req: Request, res: Response) {
        try {
            const user = (req as any).user;
            const { id } = req.params;
            const dto = req.body as UpdateCalendarEventDto;

            // Role check for shared events
            if (dto.visibility === "class" || dto.visibility === "school") {
                const canShare = ["super_admin", "school_admin", "teacher"].includes(user.role);
                if (!canShare) {
                    return res.status(403).json({ message: "Only administrators and teachers can update shared events." });
                }
            }

            // Guard: cannot update events to the past
            if (dto.startDate && new Date(dto.startDate) < new Date()) {
                return res.status(400).json({ message: "Cannot set event dates in the past." });
            }

            const event = await calendarService.updateEvent(user.id, id, dto);
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
