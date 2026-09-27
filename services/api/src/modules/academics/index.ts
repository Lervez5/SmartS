import { Router } from "express";

export const router: Router = Router();

/**
 * academics module - migrated
 * Legacy source: modules/subjects, modules/courses, modules/timetable
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "academics", state: "migrated" });
});
