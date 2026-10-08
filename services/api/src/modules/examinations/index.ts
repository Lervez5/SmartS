import { Router } from "express";

export const router: Router = Router();

/**
 * examinations module - planned
 * Legacy source: none
 * TODO: implement domain endpoints.
 */
router.get("/", (_req, res) => {
  res.json({ service: "school-os-api", module: "examinations", state: "planned" });
});
