import { Router } from "express";
import {
  createAssignmentController,
  getAssignmentsByClassIdController,
  getAssignmentByIdController,
  getAssignmentSubmissionsController,
  getAssignmentWithSubmissionsController,
  getUnsubmittedStudentsController,
  submitAssignmentController,
  getMySubmissionsController,
  getSubmissionDetailsController,
  gradeSubmissionController,
  getGradingReportController,
  updateAssignmentController,
  deleteAssignmentController,
} from "./controller";
import { requireRole } from "../../security/rbac";

export const router = Router();

// Create assignment - teachers and admins only
router.post(
  "/",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    createAssignmentController(req, res).catch(next);
  }
);

// List assignments for a class
router.get(
  "/class/:classId",
  (req, res, next) => {
    getAssignmentsByClassIdController(req, res).catch(next);
  }
);

// Get assignment by ID
router.get(
  "/:id",
  (req, res, next) => {
    getAssignmentByIdController(req, res).catch(next);
  }
);

// Get all submissions for an assignment (teacher view)
router.get(
  "/:id/submissions",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    getAssignmentSubmissionsController(req, res).catch(next);
  }
);

// Get assignment with all submissions (detailed)
router.get(
  "/:id/submissions/detail",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    getAssignmentWithSubmissionsController(req, res).catch(next);
  }
);

// Get unsubmitted students for an assignment
router.get(
  "/:id/unsubmitted",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    getUnsubmittedStudentsController(req, res).catch(next);
  }
);

// Submit assignment - students
router.post(
  "/:assignmentId/submit",
  (req, res, next) => {
    submitAssignmentController(req, res).catch(next);
  }
);

// Get my submissions - student
router.get(
  "/my-submissions",
  (req, res, next) => {
    getMySubmissionsController(req, res).catch(next);
  }
);

// Get submission details
router.get(
  "/submission/:id",
  (req, res, next) => {
    getSubmissionDetailsController(req, res).catch(next);
  }
);

// Grade submission - teachers
router.post(
  "/submission/:id/grade",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    gradeSubmissionController(req, res).catch(next);
  }
);

// Grading report - teachers
router.get(
  "/:id/grading-report",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    getGradingReportController(req, res).catch(next);
  }
);

// Update assignment - teachers/admins
router.put(
  "/:id",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    updateAssignmentController(req, res).catch(next);
  }
);

// Delete assignment - teachers/admins
router.delete(
  "/:id",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    deleteAssignmentController(req, res).catch(next);
  }
);
