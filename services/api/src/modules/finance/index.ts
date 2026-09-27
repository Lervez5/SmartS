import { Router } from "express";

export const router: Router = Router();

/**
 * finance module - migrated
 * Legacy source: modules/payments, modules/subscriptions
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "finance", state: "migrated" });
});
