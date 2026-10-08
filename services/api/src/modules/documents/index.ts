import { Router } from "express";

export const router: Router = Router();

/**
 * documents module - migrated
 * Legacy source: modules/upload
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "documents", state: "migrated" });
});
