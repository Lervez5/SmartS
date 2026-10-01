import { prisma } from '../../infrastructure/database';

export interface ListAuditLogsOptions {
  search?: string;
  action?: string;
  limit?: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  action: string;
  details: string | null;
  createdAt: Date;
  user: { id: string; name: string | null; email: string } | null;
}

export async function listAuditLogs(options: ListAuditLogsOptions = {}): Promise<AuditLogEntry[]> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);

  return prisma.auditLog.findMany({
    where: {
      ...(options.action ? { action: options.action } : {}),
      ...(options.search
        ? {
            OR: [
              { action: { contains: options.search, mode: 'insensitive' } },
              { details: { contains: options.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      userId: true,
      action: true,
      details: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function recordAuditLog(
  userId: string | null,
  action: string,
  details?: string
): Promise<void> {
  await prisma.auditLog.create({ data: { userId, action, details } });
}
