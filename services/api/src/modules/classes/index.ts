import { Router } from "express";

export const router: Router = Router();

/**
 * classes module - migrated
 * Legacy source: modules/classes
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "classes", state: "migrated" });
});
