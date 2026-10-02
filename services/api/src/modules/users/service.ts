import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { ApiError } from '../../shared/logger';
import { CreateUserInput, UpdateUserInput, UpdateMeInput, UpdateMyPasswordInput } from './schema';
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  updateUserRepo,
  BulkUserData,
} from './repository';
import { addEmailJob } from '../../infrastructure/queues';
import { config } from '../../config';

export async function createUserService(input: CreateUserInput) {
  const { default: argon2 } = await import('argon2');
  const passwordHash = await argon2.hash(input.password);

  const user = await createUser(
    input.email,
    passwordHash,
    input.role,
    input.firstName,
    input.lastName,
    input.avatar
  );

  const role = user.roleMemberships[0]?.role;

  return {
    id: user.id,
    email: user.email,
    role: role?.name ?? input.role,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
  };
}

export async function listUsersService() {
  const users = await listUsers();
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.roleMemberships[0]?.role.name ?? 'student',
    name: u.name,
    isActive: u.status === 'active',
    invitationStatus: u.status === 'pending' ? 'pending' : 'accepted',
    // Whether the account already carries a learner profile. Enrolment
    // (POST /api/students) attaches a profile to an existing account and
    // rejects one that already has it, so a caller needs to know which
    // accounts are still eligible without fetching every profile first.
    hasStudentProfile: Boolean(u.studentProfile),
    // Same reasoning for staff: enrolment-style flows need to know which
    // accounts are still eligible without fetching every profile.
    hasStaffProfile: Boolean(u.staffProfile),
    // Same reasoning for guardians: Add Parent needs to know which accounts can
    // still be attached without fetching every profile.
    hasParentProfile: Boolean(u.parentProfile),
  }));
}

export async function updateUserService(id: string, input: UpdateUserInput) {
  const existing = await getUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.email) data.email = input.email.toLowerCase();
  if (input.password) {
    const { default: argon2 } = await import('argon2');
    data.passwordHash = await argon2.hash(input.password);
  }
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.avatar !== undefined) data.avatar = input.avatar;

  const updated = await updateUserRepo(id, data);
  const role = updated.roleMemberships[0]?.role;
  return {
    id: updated.id,
    email: updated.email,
    role: role?.name ?? 'student',
  };
}

export async function deleteUserService(id: string) {
  await deleteUser(id);
  return { success: true };
}

export async function updateMeService(id: string, input: UpdateMeInput) {
  const existing = await getUserById(id);
  if (!existing) {
    throw new ApiError(404, 'User not found');
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email) data.email = input.email.toLowerCase();
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.avatar !== undefined) data.avatar = input.avatar;

  const updated = await updateUserRepo(id, data);
  const role = updated.roleMemberships[0]?.role;
  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: role?.name ?? 'student',
    firstName: updated.firstName,
    lastName: updated.lastName,
    avatar: updated.avatar,
  };
}

export async function updateMyPasswordService(id: string, input: UpdateMyPasswordInput) {
  const existing = await getUserById(id);
  if (!existing || !existing.passwordHash) {
    throw new ApiError(404, 'User not found');
  }

  const { default: argon2 } = await import('argon2');
  const valid = await argon2.verify(existing.passwordHash, input.currentPassword);
  if (!valid) {
    throw new ApiError(400, 'Incorrect current password');
  }

  const newHash = await argon2.hash(input.newPassword);
  await updateUserRepo(id, { passwordHash: newHash });
  return { success: true };
}

export async function bulkCreateUsersService(
  users: (BulkUserData & { role?: string })[],
  adminId: string
) {
  void adminId;
  const results = await Promise.all(
    users.map(async (u) => {
      const { default: argon2 } = await import('argon2');
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await argon2.hash(randomPassword);

      const user = await createUser(
        u.email,
        passwordHash,
        u.role || 'student',
        u.firstName,
        u.lastName,
        u.avatar
      );

      const invitationToken = crypto.randomBytes(32).toString('hex');

      await addEmailJob(user.email, 'invitation', {
        name: u.firstName || u.email,
        role: user.roleMemberships[0]?.role.name,
        activationLink: `${config.urls.parent}/activate-account/${invitationToken}`,
      });

      return user;
    })
  );

  return { count: results.length };
}
