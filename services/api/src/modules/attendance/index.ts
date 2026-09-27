import { Router } from "express";

export const router: Router = Router();

/**
 * attendance module - migrated
 * Legacy source: modules/attendance
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "attendance", state: "migrated" });
});
