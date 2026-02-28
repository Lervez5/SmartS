import { Router } from "express";
import {
  predictSkillController,
  recommendNextController,
  scoreResponseController,
} from "./controller";

export const router = Router();

router.post("/predict-skill", (req, res, next) => {
  predictSkillController(req, res).catch(next);
});

router.post("/recommend-next", (req, res, next) => {
  recommendNextController(req, res).catch(next);
});

router.post("/score-response", (req, res, next) => {
  scoreResponseController(req, res).catch(next);
});


