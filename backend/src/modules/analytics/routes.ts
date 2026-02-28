import { Router } from "express";
import { childProgressController, systemStatsController } from "./controller";

export const router = Router();

router.get("/child/:childId", (req, res, next) => {
  childProgressController(req, res).catch(next);
});

router.get("/system/overview", (req, res, next) => {
  systemStatsController(req, res).catch(next);
});


