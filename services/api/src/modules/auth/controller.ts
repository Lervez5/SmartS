import { Request, Response } from "express";
import { loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } from "./schema";
import { loginService, registerService, forgotPasswordService, resetPasswordService } from "./service";
import { setAuthCookies, clearAuthCookies } from "../../middleware/auth";

export async function loginController(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.parse(req.body);
  const result = await loginService(parsed);
  setAuthCookies(res, result.tokens);
  res.json({ user: result.user });
}

export async function registerController(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.parse(req.body);
  const result = await registerService(parsed);
  setAuthCookies(res, result.tokens);
  res.status(201).json({ user: result.user });
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
  const parsed = forgotPasswordSchema.parse(req.body);
  const result = await forgotPasswordService(parsed);
  res.json(result);
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
  const parsed = resetPasswordSchema.parse(req.body);
  const result = await resetPasswordService(parsed);
  res.json(result);
}

export function logoutController(_req: Request, res: Response): void {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
}

/**
 * Rehydrates the client session. The access token lives in an httpOnly cookie,
 * so the browser cannot read it; this lets the frontend resolve the current
 * user after a reload or in a fresh tab.
 */
export function meController(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }
  res.json({ user: req.user });
}
