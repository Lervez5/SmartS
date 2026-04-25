import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  });
}

export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}) {
  return prisma.user.create({
    data,
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
  });
}

export async function updateUser(id: string, data: any) {
  return prisma.user.update({
    where: { id },
    data,
  });
}
