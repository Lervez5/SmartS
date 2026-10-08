import { Router } from "express";

export const router: Router = Router();

/**
 * expenses module - planned
 * Legacy source: none
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "expenses", state: "planned" });
});
