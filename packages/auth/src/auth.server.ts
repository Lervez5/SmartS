import jwt from "jsonwebtoken";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name?: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export function signAccessToken(user: AuthUser, secret: string, expiresIn: string): string {
  return jwt.sign(user, secret, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

export function signRefreshToken(user: AuthUser, secret: string, expiresIn: string): string {
  return jwt.sign(user, secret, { expiresIn: expiresIn as jwt.SignOptions["expiresIn"] });
}

export function verifyToken(token: string, secret: string): AuthUser | null {
  try {
    return jwt.verify(token, secret) as AuthUser;
  } catch {
    return null;
  }
}

export function parseAuthHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice("Bearer ".length);
}

export function can(user: AuthUser | undefined, permission: string): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}

export function canAny(user: AuthUser | undefined, permissions: string[]): boolean {
  if (!user) return false;
  return permissions.some((p) => user.permissions.includes(p));
}

export function hasRole(user: AuthUser | undefined, role: string | string[]): boolean {
  if (!user) return false;
  const roles = Array.isArray(role) ? role : [role];
  return roles.includes(user.role);
}
