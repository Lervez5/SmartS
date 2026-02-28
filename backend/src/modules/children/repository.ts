import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function createChildRepo(data: {
  userId: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
}) {
  return prisma.child.create({ data });
}

export async function listChildrenByParent(parentId: string) {
  return prisma.child.findMany({
    where: { parents: { some: { parentId } } },
  });
}

export async function listChildrenForAdmin() {
  return prisma.child.findMany();
}

export async function getChildById(id: string) {
  return prisma.child.findUnique({ where: { id } });
}

export async function updateChildRepo(
  id: string,
  data: Partial<{ firstName: string; lastName: string; birthDate: Date }>
) {
  return prisma.child.update({ where: { id }, data });
}


