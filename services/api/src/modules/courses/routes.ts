import { Router } from "express";
import {
  listCoursesController,
  getCourseController,
  createCourseController,
  updateCourseController,
  deleteCourseController,
  myCoursesController,
  completeLessonController,
  listClassesController,
  getClassController,
  createClassController,
  addScheduleController,
  removeScheduleController,
} from "./controller";
import { requireRole } from "../../middleware/rbac";

export const router: Router = Router();

const requireStaff = requireRole("super_admin", "school_admin", "teacher");

router.get("/student/my-courses", (req, res, next) => {
  myCoursesController(req, res).catch(next);
});

router.get("/", (req, res, next) => {
  listCoursesController(req, res).catch(next);
});

router.post("/", requireStaff, (req, res, next) => {
  createCourseController(req, res).catch(next);
});

router.put("/:id", requireStaff, (req, res, next) => {
  updateCourseController(req, res).catch(next);
});

router.delete("/:id", requireStaff, (req, res, next) => {
  deleteCourseController(req, res).catch(next);
});

router.post("/:id/lessons/:lessonId/complete", (req, res, next) => {
  completeLessonController(req, res).catch(next);
});

router.get("/classes", (req, res, next) => {
  listClassesController(req, res).catch(next);
});

router.get("/classes/:id", (req, res, next) => {
  getClassController(req, res).catch(next);
});

router.post("/classes", requireStaff, (req, res, next) => {
  createClassController(req, res).catch(next);
});

router.post("/classes/:id/schedules", requireStaff, (req, res, next) => {
  addScheduleController(req, res).catch(next);
});

router.delete("/classes/schedules/:scheduleId", requireStaff, (req, res, next) => {
  removeScheduleController(req, res).catch(next);
});
