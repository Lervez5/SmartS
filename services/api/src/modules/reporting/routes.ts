import { Router } from "express";
import {
  academicReportController,
  attendanceReportController,
  financialReportController,
  analyticsController,
  exportController,
} from "./controller";
import { requireRole } from "../../middleware/rbac";

export const router: Router = Router();

const requireAdmin = requireRole("super_admin", "school_admin");

router.get("/academic", requireAdmin, (req, res, next) => {
  academicReportController(req, res).catch(next);
});

router.get("/attendance", requireAdmin, (req, res, next) => {
  attendanceReportController(req, res).catch(next);
});

router.get("/financial", requireAdmin, (req, res, next) => {
  financialReportController(req, res).catch(next);
});

router.get("/analytics", requireAdmin, (req, res, next) => {
  analyticsController(req, res).catch(next);
});

router.post("/export", requireAdmin, (req, res, next) => {
  exportController(req, res).catch(next);
});
