import { Router } from "express";
import { childProgressController, systemStatsController, platformMetricsController } from "./controller";

export const router = Router();

router.get("/child/:childId", (req, res, next) => {
  childProgressController(req, res).catch(next);
});

router.get("/system/overview", (req, res, next) => {
  systemStatsController(req, res).catch(next);
});

router.get("/system/metrics", (req, res, next) => {
  platformMetricsController(req, res).catch(next);
});


