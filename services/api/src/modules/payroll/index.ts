import { Router } from "express";

export const router: Router = Router();

/**
 * payroll module - planned
 * Legacy source: none
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "payroll", state: "planned" });
});
