import { Router } from "express";
import {
  getMyBadgesController,
  leaderboardController,
  postEventController,
} from "./controller";

export const router = Router();

router.post("/events", (req, res, next) => {
  postEventController(req, res).catch(next);
});

router.get("/badges/me", (req, res, next) => {
  getMyBadgesController(req, res).catch(next);
});

router.get("/leaderboard", (req, res, next) => {
  leaderboardController(req, res).catch(next);
});


