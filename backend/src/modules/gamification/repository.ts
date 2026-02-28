import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function addXp(studentId: string, amount: number) {
  return prisma.gamificationProfile.upsert({
    where: { studentId },
    update: { xp: { increment: amount } },
    create: { studentId, xp: amount, level: 1 },
  });
}

export async function awardBadge(studentId: string, badgeCode: string) {
  return prisma.gamificationBadge.create({
    data: {
      studentId,
      code: badgeCode,
      awardedAt: new Date(),
    },
  });
}

export async function listBadges(studentId: string) {
  return prisma.gamificationBadge.findMany({
    where: { studentId },
    orderBy: { awardedAt: "desc" },
  });
}

export async function leaderboard(limit: number) {
  return prisma.gamificationProfile.findMany({
    orderBy: [{ level: "desc" }, { xp: "desc" }],
    take: limit,
  });
}


