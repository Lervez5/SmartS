import { Router } from "express";

export const router: Router = Router();

/**
 * communication module - migrated
 * Legacy source: modules/messages
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "communication", state: "migrated" });
});
