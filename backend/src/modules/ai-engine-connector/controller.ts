import { Request, Response } from "express";
import { predictSkill, recommendNext, scoreResponseAi } from "./service";
import { ApiError } from "../../shared/errorHandler";

export async function predictSkillController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const data = await predictSkill(req.body);
  res.json(data);
}

export async function recommendNextController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const data = await recommendNext(req.body);
  res.json(data);
}

export async function scoreResponseController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const data = await scoreResponseAi(req.body);
  res.json(data);
}


