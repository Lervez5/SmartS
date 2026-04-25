import { Router } from "express";
import {
  getStudentDashboardController,
  getTeacherDashboardController,
  getAdminDashboardController,
} from "./controller";

export const router = Router();

router.get("/student", getStudentDashboardController);
router.get("/teacher", getTeacherDashboardController);
router.get("/admin", getAdminDashboardController);
