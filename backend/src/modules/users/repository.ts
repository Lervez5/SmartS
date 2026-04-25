import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export async function createUser(email: string, passwordHash: string, role: Role, firstName?: string, lastName?: string, avatar?: string) {
  return prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash, role, firstName, lastName, avatar, isActive: false },
  });
}

export async function listUsers() {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { invitation: true }
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function updateUserRepo(
  id: string,
  fields: Partial<{ name: string; email: string; passwordHash: string; role: Role; firstName: string; lastName: string; avatar: string }>
) {
  return prisma.user.update({
    where: { id },
    data: fields,
  });
}

export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

export async function bulkCreateUsers(data: any[]) {
  return prisma.user.createMany({
    data: data.map(u => ({
      ...u,
      email: u.email.toLowerCase()
    })),
    skipDuplicates: true
  });
}


