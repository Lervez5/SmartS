import { Router } from "express";
import * as controller from "./controller";

export const router = Router();

router.get("/", controller.getAllCourses);
router.get("/:id", controller.getCourseById);
router.post("/", controller.createCourse);
router.put("/:id", controller.updateCourse);
router.delete("/:id", controller.deleteCourse);

// Student Course Operations
router.get("/student/my-courses", controller.getStudentEnrollments);
router.post("/:id/lessons/:lessonId/complete", controller.completeLesson);

// Module Operations
router.put("/modules/:moduleId/toggle-lock", controller.toggleModuleLock);
