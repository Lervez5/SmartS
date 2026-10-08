import { Router } from "express";
import {
  listCohortsController,
  getCohortController,
  createCohortController,
  updateCohortController,
  deleteCohortController,
  addStudentController,
  removeStudentController,
} from "./controller";
import { requireRole } from "../../middleware/rbac";

export const router: Router = Router();

const requireAdmin = requireRole("super_admin", "school_admin");

router.get("/", (req, res, next) => {
  listCohortsController(req, res).catch(next);
});

router.post("/", requireAdmin, (req, res, next) => {
  createCohortController(req, res).catch(next);
});

router.get("/:id", (req, res, next) => {
  getCohortController(req, res).catch(next);
});

router.put("/:id", requireAdmin, (req, res, next) => {
  updateCohortController(req, res).catch(next);
});

router.delete("/:id", requireAdmin, (req, res, next) => {
  deleteCohortController(req, res).catch(next);
});

router.post("/:id/students", requireAdmin, (req, res, next) => {
  addStudentController(req, res).catch(next);
});

router.delete("/:id/students/:studentId", requireAdmin, (req, res, next) => {
  removeStudentController(req, res).catch(next);
});
