import { Request, Response, NextFunction } from "express";
import { reportingService } from "./service";
import { ApiError } from "../../shared/errorHandler";

export async function getAcademicReport(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user || !["super_admin", "school_admin"].includes(req.user.role)) {
            throw new ApiError(403, "Admin access required");
        }
        const report = await reportingService.getAcademicReport();
        res.json(report);
    } catch (error) {
        next(error);
    }
}

export async function getAttendanceReport(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user || !["super_admin", "school_admin"].includes(req.user.role)) {
            throw new ApiError(403, "Admin access required");
        }
        const report = await reportingService.getAttendanceReport();
        res.json(report);
    } catch (error) {
        next(error);
    }
}

export async function getFinancialReport(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user || !["super_admin", "school_admin"].includes(req.user.role)) {
            throw new ApiError(403, "Admin access required");
        }
        const report = await reportingService.getFinancialReport();
        res.json(report);
    } catch (error) {
        next(error);
    }
}

export async function getPlatformAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user || !["super_admin", "school_admin"].includes(req.user.role)) {
            throw new ApiError(403, "Admin access required");
        }
        const analytics = await reportingService.getPlatformAnalytics();
        res.json(analytics);
    } catch (error) {
        next(error);
    }
}import { reportingQueue } from "./queue";

export async function triggerReportExport(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user || !["super_admin", "school_admin"].includes(req.user.role)) {
            throw new ApiError(403, "Admin access required");
        }
        const { type, format } = req.body;
        const job = await reportingQueue.add(`export-${type}-${Date.now()}`, {
            type,
            format,
            userId: req.user.id
        });
        res.json({ jobId: job.id, message: "Report generation started in background" });
    } catch (error) {
        next(error);
    }
}
