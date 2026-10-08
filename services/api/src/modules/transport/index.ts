import { Router } from "express";

export const router: Router = Router();

/**
 * transport module - planned
 * Legacy source: none
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "transport", state: "planned" });
});
