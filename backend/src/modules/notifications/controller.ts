import { Request, Response } from "express";
import { createNotificationSchema } from "./schema";
import {
  createNotificationService,
  listMyNotificationsService,
  markNotificationReadService,
} from "./service";
import { ApiError } from "../../shared/errorHandler";

export async function listMyNotificationsController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const notifications = await listMyNotificationsService(req.user.id);
  res.json({ notifications });
}

export async function createNotificationController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin role required");
  }
  const parsed = createNotificationSchema.parse(req.body);
  const notification = await createNotificationService(parsed);
  res.status(201).json({ notification });
}

export async function markNotificationReadController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const result = await markNotificationReadService(req.user.id, req.params.id);
  res.json(result);
}


