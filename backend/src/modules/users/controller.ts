import { Request, Response } from "express";
import { requireRole } from "../../security/rbac";
import { createUserSchema, updateUserSchema, updateMeSchema, updateMyPasswordSchema } from "./schema";
import {
  createUserService,
  deleteUserService,
  listUsersService,
  updateUserService,
  updateMeService,
  updateMyPasswordService,
} from "./service";

export const requireAdmin = requireRole(["admin"]);

export async function listUsersController(_req: Request, res: Response) {
  const users = await listUsersService();
  res.json({ users });
}

export async function createUserController(req: Request, res: Response) {
  const parsed = createUserSchema.parse(req.body);
  const user = await createUserService(parsed);
  res.status(201).json({ user });
}

export async function updateUserController(req: Request, res: Response) {
  const parsed = updateUserSchema.parse(req.body);
  const user = await updateUserService(req.params.id, parsed);
  res.json({ user });
}

export async function deleteUserController(req: Request, res: Response) {
  await deleteUserService(req.params.id);
  res.status(204).send();
}

export async function updateMeController(req: Request, res: Response) {
  const parsed = updateMeSchema.parse(req.body);
  const user = await updateMeService((req as any).user.id, parsed);
  res.json({ user });
}

export async function updateMyPasswordController(req: Request, res: Response) {
  const parsed = updateMyPasswordSchema.parse(req.body);
  await updateMyPasswordService((req as any).user.id, parsed);
  res.json({ message: "Password updated successfully" });
}


