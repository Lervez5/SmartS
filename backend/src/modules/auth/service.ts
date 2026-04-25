import argon2 from "argon2";
import crypto from "crypto";
import { findUserByEmail, createUser, findUserByResetToken, updateUser } from "./repository";
import { LoginInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from "./schema";
import { ApiError } from "../../shared/errorHandler";
import { signTokens } from "../../security/auth";
import { AuthUser } from "../../security/rbac";

export async function login(payload: LoginInput) {
  const user = await findUserByEmail(payload.email.toLowerCase());
  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const valid = await argon2.verify(user.passwordHash, payload.password);
  if (!valid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    role: user.role as AuthUser["role"],
    name: user.name || undefined
  };

  const tokens = signTokens(authUser);
  return { user: authUser, tokens };
}

export async function register(payload: RegisterInput) {
  const existing = await findUserByEmail(payload.email.toLowerCase());
  if (existing) {
    throw new ApiError(400, "User already exists");
  }

  const passwordHash = await argon2.hash(payload.password);
  const user = await createUser({
    name: payload.name,
    email: payload.email.toLowerCase(),
    passwordHash,
    role: payload.role as any,
  });

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    role: user.role as AuthUser["role"],
    name: user.name || undefined
  };

  const tokens = signTokens(authUser);
  return { user: authUser, tokens };
}

export async function forgotPassword(payload: ForgotPasswordInput) {
  const user = await findUserByEmail(payload.email.toLowerCase());
  // We don't want to leak if a user exists, but for this dev stage we'll throw error
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour

  await updateUser(user.id, {
    passwordResetToken: token,
    passwordResetExpires: expires,
  });

  // Mock email log
  console.log("\n=======================================================");
  console.log(`📧 [EMAIL MOCK] Password Reset Requested`);
  console.log(`To: ${user.email}`);
  console.log(`Reset Token: ${token}`);
  console.log("=======================================================\n");

  return { message: "Password reset link sent (Check server logs in dev mode)" };
}

export async function resetPassword(payload: ResetPasswordInput) {
  const user = await findUserByResetToken(payload.token);
  if (!user) {
    throw new ApiError(400, "Invalid or expired reset token");
  }

  const passwordHash = await argon2.hash(payload.password);
  await updateUser(user.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  });

  return { message: "Password updated successfully" };
}
