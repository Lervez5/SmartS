import { prisma } from "../../infrastructure/database";

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

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      roleMemberships: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: string;
}) {
  return prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      name: data.name,
      passwordHash: data.passwordHash,
      status: "active",
      roleMemberships: {
        create: {
          role: {
            connect: { name: data.role },
          },
        },
      },
    },
    include: {
      roleMemberships: {
        include: {
          role: true,
        },
      },
    },
  });
}

export async function findUserByResetToken(token: string) {
  return prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        gt: new Date(),
      },
    },
    include: {
      roleMemberships: {
        include: {
          role: true,
        },
      },
    },
  });
}

import { Prisma } from "@prisma/client";

export async function updateUser(id: string, data: Prisma.UserUpdateInput) {
  return prisma.user.update({
    where: { id },
    data,
  });
}
