import argon2 from "argon2";
import { Role } from "@prisma/client";
import { ApiError } from "../../shared/errorHandler";
import { CreateUserInput, UpdateUserInput, UpdateMeInput, UpdateMyPasswordInput } from "./schema";
import { createUser, deleteUser, getUserById, listUsers, updateUserRepo } from "./repository";

export async function createUserService(input: CreateUserInput) {
  const passwordHash = await argon2.hash(input.password);
  const user = (await createUser(input.email, passwordHash, input.role as Role, input.firstName, input.lastName, input.avatar)) as any;
  return { id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar };
}

export async function listUsersService() {
  const users = await listUsers();
  return users.map((u) => ({ id: u.id, email: u.email, role: u.role }));
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


