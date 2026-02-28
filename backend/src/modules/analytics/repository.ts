import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function subjectProgressForChild(childId: string) {
  return prisma.progress.findMany({
    where: { childId },
    include: { subject: true },
  });
}

export async function overallSystemStats() {
  const [users, children, attempts] = await Promise.all([
    prisma.user.count(),
    prisma.child.count(),
    prisma.attempt.count(),
  ]);
  return { users, children, attempts };
}


