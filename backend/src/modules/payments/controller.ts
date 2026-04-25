import { Request, Response } from "express";
import { Role } from "../../security/rbac";
import { createCheckoutSchema, subscriptionUpdateSchema } from "./schema";
import {
  adminUpdateSubscriptionService,
  createCheckoutService,
  listMyPaymentsService,
  mySubscriptionService,
} from "./service";
import { ApiError } from "../../shared/errorHandler";

export async function createCheckoutController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "parent") {
    throw new ApiError(403, "Only parents can initiate payments");
  }
  const parsed = createCheckoutSchema.parse(req.body);
  const result = await createCheckoutService(req.user.id, parsed);
  res.status(201).json(result);
}

export async function listMyPaymentsController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const payments = await listMyPaymentsService(req.user.id);
  res.json({ payments });
}

export async function mySubscriptionController(req: Request, res: Response) {
  if (!req.user) {
    throw new ApiError(401, "Authentication required");
  }
  const subscription = await mySubscriptionService(req.user.id);
  res.json({ subscription });
}

export async function adminUpdateSubscriptionController(req: Request, res: Response) {
  if (!req.user || req.user.role !== "super_admin") {
    throw new ApiError(403, "Super admin role required");
  }
  const parsed = subscriptionUpdateSchema.parse(req.body);
  const subscription = await adminUpdateSubscriptionService(req.params.userId, parsed);
  res.json({ subscription });
}


