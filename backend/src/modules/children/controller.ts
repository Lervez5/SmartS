import { Request, Response } from "express";
import { createChildSchema, updateChildSchema } from "./schema";
import { createChildService, listChildrenForUser, updateChildService } from "./service";
import { ApiError } from "../../shared/errorHandler";

export async function listChildrenController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const children = await listChildrenForUser(req.user.id, req.user.role);
  res.json({ children });
}

export async function createChildController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Only admins can create children");
  }
  const parsed = createChildSchema.parse(req.body);
  const child = await createChildService(parsed);
  res.status(201).json({ child });
}

export async function updateChildController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const parsed = updateChildSchema.parse(req.body);
  const child = await updateChildService(req.params.id, parsed, req.user.id, req.user.role);
  res.json({ child });
}


