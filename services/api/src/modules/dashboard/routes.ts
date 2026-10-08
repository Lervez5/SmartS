import { Router } from "express";
import {
  studentDashboardController,
  teacherDashboardController,
  adminDashboardController,
  parentDashboardController,
} from "./controller";
import { requireRole } from "../../middleware/rbac";

export const router: Router = Router();

router.get("/student", requireRole("student"), (req, res, next) => {
  studentDashboardController(req, res).catch(next);
});

router.get("/teacher", requireRole("teacher"), (req, res, next) => {
  teacherDashboardController(req, res).catch(next);
});

router.get("/admin", requireRole("super_admin", "school_admin"), (req, res, next) => {
  adminDashboardController(req, res).catch(next);
});

router.get("/parent", requireRole("parent"), (req, res, next) => {
  parentDashboardController(req, res).catch(next);
});
