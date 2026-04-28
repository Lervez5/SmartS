import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthUser } from "./rbac";

const ACCESS_TOKEN_TTL = "24h";
const REFRESH_TOKEN_TTL = "7d";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "dev-access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev-refresh-secret";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  userRole?: string;
}

export function signTokens(user: AuthUser): Tokens {
  const accessToken = jwt.sign(user, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign(user, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  return { accessToken, refreshToken, userRole: user.role };
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  let token = "";

  if (header?.startsWith("Bearer ")) {
    token = header.slice("Bearer ".length);
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as AuthUser;
    req.user = decoded;
  } catch {
    // ignore, user remains unauthenticated
  }
  next();
}

export function setAuthCookies(res: Response, tokens: Tokens) {
  const isProd = process.env.NODE_ENV === "production";
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
  // Non-httpOnly cookie for role-based logic in middleware/frontend
  res.cookie("userRole", tokens.userRole || "", {
    httpOnly: false,
    sameSite: "strict",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === "production";
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
}


