import { Request, Response } from "express";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "./schema";
import { login, register, forgotPassword, resetPassword } from "./service";
import { setAuthCookies, clearAuthCookies } from "../../security/auth";

export async function loginController(req: Request, res: Response) {
  const parsed = loginSchema.parse(req.body);
  const result = await login(parsed);
  setAuthCookies(res, result.tokens);
  res.json({ user: result.user });
}

export async function registerController(req: Request, res: Response) {
  const parsed = registerSchema.parse(req.body);
  const result = await register(parsed);
  setAuthCookies(res, result.tokens);
  res.status(201).json({ user: result.user });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const parsed = forgotPasswordSchema.parse(req.body);
  const result = await forgotPassword(parsed);
  res.json(result);
}

export async function resetPasswordController(req: Request, res: Response) {
  const parsed = resetPasswordSchema.parse(req.body);
  const result = await resetPassword(parsed);
  res.json(result);
}

export function logoutController(req: Request, res: Response) {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
}
