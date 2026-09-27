import crypto from "crypto";
import { ApiError, logger } from "../../shared/logger";
import { findUserByEmail, createUser, findUserByResetToken, updateUser } from "./repository";
import { AuthResult } from "./types";
import { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from "./schema";
import { signTokens } from "../../middleware/auth";
import type { Role, Permission } from "@prisma/client";

interface RoleWithPermissions extends Role {
  rolePermissions?: { permission: Permission }[];
}

export async function loginService(payload: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(payload.email.toLowerCase());

  if (!user || !user.passwordHash) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { default: argon2 } = await import("argon2");
  const valid = await argon2.verify(user.passwordHash, payload.password);

  if (!valid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const role = user.roleMemberships[0]?.role as RoleWithPermissions | undefined;
  const permissions = role?.rolePermissions?.map((rp) => rp.permission.key) ?? [];

  const authUser = {
    id: user.id,
    email: user.email,
    role: role?.name ?? "student",
    name: user.name || undefined,
    permissions,
  };

  const tokens = signTokens(authUser);
  return { user: authUser, tokens };
}

export async function registerService(payload: RegisterInput): Promise<AuthResult> {
  const existing = await findUserByEmail(payload.email.toLowerCase());
  if (existing) {
    throw new ApiError(400, "User already exists");
  }

  const { default: argon2 } = await import("argon2");
  const passwordHash = await argon2.hash(payload.password);

  const user = await createUser({
    name: payload.name,
    email: payload.email.toLowerCase(),
    passwordHash,
    role: payload.role,
  });

  const role = user.roleMemberships[0]?.role as RoleWithPermissions | undefined;

  const authUser = {
    id: user.id,
    email: user.email,
    role: role?.name ?? "student",
    name: user.name || undefined,
    permissions: (role?.rolePermissions ?? []).map((rp) => rp.permission.key),
  };

  const tokens = signTokens(authUser);
  return { user: authUser, tokens };
}

export async function forgotPasswordService(payload: ForgotPasswordInput): Promise<{ message: string }> {
  const user = await findUserByEmail(payload.email.toLowerCase());
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000);

  await updateUser(user.id, {
    passwordResetToken: token,
    passwordResetExpires: expires,
  });

  logger.info("Password reset requested", { event: "password_reset_requested", email: user.email, token });

  return { message: "Password reset link sent (Check server logs in dev mode)" };
}

export async function resetPasswordService(payload: ResetPasswordInput): Promise<{ message: string }> {
  const user = await findUserByResetToken(payload.token);
  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const { default: argon2 } = await import("argon2");
  const passwordHash = await argon2.hash(payload.password);

  await updateUser(user.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  });

  return { message: "Password updated successfully" };
}
