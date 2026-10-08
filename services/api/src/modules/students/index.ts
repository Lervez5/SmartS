import { Router } from "express";

export const router: Router = Router();

/**
 * students module - migrated
 * Legacy source: modules/children
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "students", state: "migrated" });
});
