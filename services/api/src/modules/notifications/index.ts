import { Router } from "express";

export const router: Router = Router();

/**
 * notifications module - migrated
 * Legacy source: modules/notifications
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "notifications", state: "migrated" });
});
