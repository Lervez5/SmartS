import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function listAuditLogs(limit: number) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: true },
  });
}

export function createAuditLogRepo(userId: string | null, action: string, details: string) {
  return prisma.auditLog.create({
    data: { userId, action, details }
  });
}


