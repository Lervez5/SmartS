import { Router } from "express";
import { attendanceController } from "./controller";

export const router = Router();

// Teacher: Get today's classes with attendance status
router.get("/today", (req, res) => attendanceController.getTodayClasses(req, res));

// Teacher: Get roster for a class on a date
router.get("/roster/:classId", (req, res) => attendanceController.getRoster(req, res));

// Teacher: Bulk mark attendance (draft or final)
router.post("/mark", (req, res) => attendanceController.markAttendance(req, res));

// Student / Teacher: Attendance history for a student
router.get("/history/me", (req, res) => attendanceController.getStudentHistory(req, res));
router.get("/history/:studentId", (req, res) => attendanceController.getStudentHistory(req, res));

// Admin / Teacher: Attendance reports
router.get("/reports", (req, res) => attendanceController.getReports(req, res));
