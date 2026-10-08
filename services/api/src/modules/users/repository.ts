import { prisma } from "../../infrastructure/database";
import { Prisma, UserStatus } from "@prisma/client";

export interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  email: string;
  passwordHash: string;
  role: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface UpdateUserDto {
  email?: string;
  passwordHash?: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export async function createUser(email: string, passwordHash: string, role: string, firstName?: string, lastName?: string, avatar?: string) {
  return prisma.user.create({
    data: {
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      avatar,
      roleMemberships: {
        create: {
          role: { connect: { name: role } },
        },
      },
    },
    include: { roleMemberships: { include: { role: true } } },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      roleMemberships: { include: { role: true } },
    },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      roleMemberships: { include: { role: true } },
    },
  });
}

export async function updateUserRepo(
  id: string,
  data: Prisma.UserUpdateInput
) {

  return prisma.user.update({
    where: { id },
    data,
    include: { roleMemberships: { include: { role: true } } },
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export interface BulkUserData {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export async function bulkCreateUsers(data: BulkUserData[]) {
  return Promise.all(
    data.map((u) =>
      prisma.user.create({
        data: {
          email: u.email.toLowerCase(),
          passwordHash: u.passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          avatar: u.avatar,
          status: UserStatus.active,
        },
      })
    )
  );
}
