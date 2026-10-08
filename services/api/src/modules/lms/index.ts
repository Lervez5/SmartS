import { Router } from "express";

export const router: Router = Router();

/**
 * lms module - migrated
 * Legacy source: modules/courses, modules/assignments, modules/assignments/submission
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "lms", state: "migrated" });
});
