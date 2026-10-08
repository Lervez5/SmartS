import { NextFunction, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "../config";

export type Permission = string;

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  permissions: Permission[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  userRole?: string;
}

export function signTokens(user: AuthUser): Tokens {
  const accessToken = jwt.sign(user, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTokenTtl as SignOptions["expiresIn"],
  });
  const refreshToken = jwt.sign(user, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTokenTtl as SignOptions["expiresIn"],
  });
  return { accessToken, refreshToken, userRole: user.role };
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  let token = "";

  if (header?.startsWith("Bearer ")) {
    token = header.slice("Bearer ".length);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AuthUser;
    req.user = decoded;
  } catch {
    // token invalid or expired - user remains unauthenticated
  }
  next();
}

export function setAuthCookies(res: Response, tokens: Tokens): void {
  const isProd = config.isProduction;
  res.cookie("accessToken", tokens.accessToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
    maxAge: 24 * 60 * 60 * 1000,
  });
  res.cookie("refreshToken", tokens.refreshToken, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie("userRole", tokens.userRole || "", {
    httpOnly: false,
    sameSite: "strict",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const isProd = config.isProduction;
  res.clearCookie("accessToken", {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    sameSite: "strict",
    secure: isProd,
  });
  res.clearCookie("userRole", {
    httpOnly: false,
    sameSite: "strict",
    secure: isProd,
  });
}

export function requireAuth(_req: Request, res: Response, next: NextFunction): void {
  if (!_req.user) {
    res.status(401).json({ error: { message: "Authentication required" } });
    return;
  }
  next();
}
