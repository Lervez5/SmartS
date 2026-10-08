import { Router } from "express";

export const router: Router = Router();

/**
 * reports module - migrated
 * Legacy source: modules/reporting, modules/analytics
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "reports", state: "migrated" });
});
