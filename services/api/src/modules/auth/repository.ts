import { prisma } from '../../infrastructure/database';
import { ROLE_APP } from '@schoolos/auth/roles';

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

export async function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
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
      status: 'active',
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

import { Prisma } from '@prisma/client';

export async function updateUser(id: string, data: Prisma.UserUpdateInput) {
  return prisma.user.update({
    where: { id },
    data,
  });
}
