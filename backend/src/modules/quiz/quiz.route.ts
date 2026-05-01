import { Router } from "express";
import {
  createQuizController,
  getQuizController,
  listQuizzesController,
  updateQuizController,
  deleteQuizController,
  createQuestionController,
  getQuestionController,
  listQuestionsController,
  updateQuestionController,
  deleteQuestionController,
  startQuizController,
  submitQuizController,
  getMyAttemptController,
  getMyAttemptsController,
  autoGradeController,
  gradeAnswerController,
  getQuizAttemptsController,
  getQuizAnalyticsController,
  getAttemptWithAnswersController,
} from "./quiz.controller";
import { requireRole } from "../../security/rbac";

export const router = Router();

/* ─── Quiz CRUD (Teachers / Admins) ─── */

router.post(
  "/",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    createQuizController(req, res).catch(next);
  }
);

router.get(
  "/",
  (req, res, next) => {
    listQuizzesController(req, res).catch(next);
  }
);

router.get(
  "/:id",
  (req, res, next) => {
    getQuizController(req, res).catch(next);
  }
);

router.put(
  "/:id",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    updateQuizController(req, res).catch(next);
  }
);

router.delete(
  "/:id",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    deleteQuizController(req, res).catch(next);
  }
);

/* ─── Question Bank ─── */

router.post(
  "/questions",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    createQuestionController(req, res).catch(next);
  }
);

router.get(
  "/questions",
  (req, res, next) => {
    listQuestionsController(req, res).catch(next);
  }
);

router.get(
  "/questions/:id",
  (req, res, next) => {
    getQuestionController(req, res).catch(next);
  }
);

router.put(
  "/questions/:id",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    updateQuestionController(req, res).catch(next);
  }
);

router.delete(
  "/questions/:id",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    deleteQuestionController(req, res).catch(next);
  }
);

/* ─── Student Attempt Flow ─── */

router.post(
  "/:quizId/start",
  (req, res, next) => {
    startQuizController(req, res).catch(next);
  }
);

router.post(
  "/:quizId/submit",
  (req, res, next) => {
    submitQuizController(req, res).catch(next);
  }
);

router.get(
  "/attempt/:attemptId",
  (req, res, next) => {
    getMyAttemptController(req, res).catch(next);
  }
);

router.get(
  "/:quizId/attempts/my",
  (req, res, next) => {
    getMyAttemptsController(req, res).catch(next);
  }
);

/* ─── Grading & Analytics (Teachers/Admins) ─── */

router.post(
  "/attempt/:attemptId/auto-grade",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    autoGradeController(req, res).catch(next);
  }
);

router.post(
  "/answer/:answerId/grade",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    gradeAnswerController(req, res).catch(next);
  }
);

router.get(
  "/:quizId/attempts",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    getQuizAttemptsController(req, res).catch(next);
  }
);

router.get(
  "/:quizId/analytics",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    getQuizAnalyticsController(req, res).catch(next);
  }
);

router.get(
  "/attempt/:attemptId/detail",
  requireRole(["teacher", "school_admin", "super_admin"]),
  (req, res, next) => {
    getAttemptWithAnswersController(req, res).catch(next);
  }
);
