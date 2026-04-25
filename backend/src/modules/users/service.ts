import argon2 from "argon2";
import crypto from "crypto";
import { Role } from "@prisma/client";
import { ApiError } from "../../shared/errorHandler";
import { CreateUserInput, UpdateUserInput, UpdateMeInput, UpdateMyPasswordInput } from "./schema";
import { createUser, deleteUser, getUserById, listUsers, updateUserRepo, bulkCreateUsers } from "./repository";

export async function createUserService(input: CreateUserInput) {
  const passwordHash = await argon2.hash(input.password);
  const user = (await createUser(input.email, passwordHash, input.role as Role, input.firstName, input.lastName, input.avatar)) as any;
  return { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar };
}

export async function listUsersService() {
  const users = await listUsers();
  return users.map((u) => ({ 
    id: u.id, 
    email: u.email, 
    role: u.role, 
    name: u.name,
    isActive: u.isActive,
    invitationStatus: (u as any).invitation?.status || (u.isActive ? "accepted" : "none")
  }));
}

export async function updateUserService(id: string, input: UpdateUserInput) {
  const existing = await getUserById(id);
  if (!existing) {
    throw new ApiError(404, "User not found");
  }
  const data: { email?: string; passwordHash?: string; role?: Role } = {};
  if (input.email) data.email = input.email.toLowerCase();
  if (input.password) data.passwordHash = await argon2.hash(input.password);
  if (input.role) data.role = input.role as Role;
  const updated = await updateUserRepo(id, data);
  return { id: updated.id, email: updated.email, role: updated.role };
}

export async function deleteUserService(id: string) {
  await deleteUser(id);
  return { success: true };
}

export async function updateMeService(id: string, input: UpdateMeInput) {
  const existing = await getUserById(id);
  if (!existing) {
    throw new ApiError(404, "User not found");
  }
  const data: Partial<{ name: string; email: string; firstName: string; lastName: string; avatar: string }> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email) data.email = input.email.toLowerCase();
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.avatar !== undefined) data.avatar = input.avatar;

  const updated = (await updateUserRepo(id, data)) as any;
  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    firstName: updated.firstName,
    lastName: updated.lastName,
    avatar: updated.avatar,
  };
}

export async function updateMyPasswordService(id: string, input: UpdateMyPasswordInput) {
  const existing = await getUserById(id);
  if (!existing) {
    throw new ApiError(404, "User not found");
  }

  const valid = await argon2.verify(existing.passwordHash, input.currentPassword);
  if (!valid) {
    throw new ApiError(400, "Incorrect current password");
  }

  const newHash = await argon2.hash(input.newPassword);
  await updateUserRepo(id, { passwordHash: newHash });
  return { success: true };
}

import { createInvitationService } from "../invitations/service";
import { addEmailToQueue } from "../email/queue";

export async function bulkCreateUsersService(users: any[], adminId: string) {
  const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
  
  const results = await Promise.all(users.map(async (u) => {
    // 1. Create User (Inactive)
    // We use a random password initially as they will set their own
    const randomPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await argon2.hash(randomPassword);
    
    const user = await createUser(
      u.email, 
      passwordHash, 
      (u.role || "student") as Role, 
      u.firstName, 
      u.lastName, 
      u.avatar
    );

    // 2. Create Invitation
    const invitation = await createInvitationService(user.id, adminId);

    // 3. Queue Email
    await addEmailToQueue(user.email, "invitation", {
      name: u.firstName || u.email,
      role: user.role,
      activationLink: `\${FRONTEND_URL}/activate-account/\${invitation.token}`
    });

    return user;
  }));

  return { count: results.length };
}


