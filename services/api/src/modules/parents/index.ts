import { Router } from "express";

export const router: Router = Router();

/**
 * parents module - planned
 * Legacy source: (parent-child link)
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "parents", state: "planned" });
});
