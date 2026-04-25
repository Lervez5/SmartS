import { Request, Response } from "express";
import { attendanceService } from "./service";
import { MarkAttendanceDto, AttendanceQueryDto } from "./dto";

export class AttendanceController {

    async getRoster(req: Request, res: Response) {
        try {
            const { classId } = req.params;
            const { date } = req.query as { date: string };
            if (!date) return res.status(400).json({ message: "date query param required (YYYY-MM-DD)" });

            const roster = await attendanceService.getRoster(classId, date);
            return res.json(roster);
        } catch (err: any) {
            return res.status(500).json({ message: err.message });
        }
    }

    async markAttendance(req: Request, res: Response) {
        try {
            const teacherId = (req as any).user?.id;
            if (!teacherId) return res.status(401).json({ message: "Unauthorized" });

            const dto = req.body as MarkAttendanceDto;
            if (!dto.classId || !dto.date || !Array.isArray(dto.records)) {
                return res.status(400).json({ message: "classId, date, and records are required" });
            }

            const result = await attendanceService.markAttendance(teacherId, dto);
            return res.json(result);
        } catch (err: any) {
            return res.status(400).json({ message: err.message });
        }
    }

    async getStudentHistory(req: Request, res: Response) {
        try {
            const requestingUser = (req as any).user;
            // Students can only see their own; teachers/admins can see anyone
            const studentId = requestingUser.role === "student"
                ? requestingUser.id
                : req.params.studentId;

            const query = req.query as AttendanceQueryDto;
            const result = await attendanceService.getStudentHistory(studentId, query);
            return res.json(result);
        } catch (err: any) {
            return res.status(500).json({ message: err.message });
        }
    }

    async getTodayClasses(req: Request, res: Response) {
        try {
            const teacherId = (req as any).user?.id;
            if (!teacherId) return res.status(401).json({ message: "Unauthorized" });

            const classes = await attendanceService.getTodayClasses(teacherId);
            return res.json(classes);
        } catch (err: any) {
            return res.status(500).json({ message: err.message });
        }
    }

    async getReports(req: Request, res: Response) {
        try {
            const query = req.query as AttendanceQueryDto;
            const result = await attendanceService.getReports(query);
            return res.json(result);
        } catch (err: any) {
            return res.status(500).json({ message: err.message });
        }
    }
}

export const attendanceController = new AttendanceController();
