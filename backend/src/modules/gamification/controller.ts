import { Request, Response } from "express";
import { gamificationEventSchema } from "./schema";
import { getBadges, getLeaderboard, handleEvent } from "./service";
import { ApiError } from "../../shared/errorHandler";

export async function postEventController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "student") {
    throw new ApiError(403, "Only students can trigger gamification events");
  }
  const parsed = gamificationEventSchema.parse(req.body);
  if (parsed.studentId !== req.user.id) {
    throw new ApiError(403, "Cannot submit events for another student");
  }
  const result = await handleEvent(parsed);
  res.json(result);
}

export async function getMyBadgesController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "student") {
    throw new ApiError(403, "Only students can view their badges");
  }
  const badges = await getBadges(req.user.id);
  res.json({ badges });
}

export async function leaderboardController(_req: Request, res: Response) {
  const list = await getLeaderboard(10);
  res.json({ leaderboard: list });
}


