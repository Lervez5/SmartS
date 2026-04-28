import { Router } from "express";
import * as controller from "./controller";

export const router = Router();

router.get("/academic", controller.getAcademicReport);
router.get("/attendance", controller.getAttendanceReport);
router.get("/financial", controller.getFinancialReport);
router.get("/analytics", controller.getPlatformAnalytics);
router.post("/export", controller.triggerReportExport);
