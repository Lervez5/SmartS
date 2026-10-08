import { Router } from "express";

export const router: Router = Router();

/**
 * subjects module - migrated
 * Legacy source: modules/subjects
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "subjects", state: "migrated" });
});
