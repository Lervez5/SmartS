import { prisma } from '../../infrastructure/database';

export interface ListAuditLogsOptions {
  search?: string;
  action?: string;
  /**
   * Restrict the trail to one school.
   *
   * The audit log records what a school did, so a school reads its own. Without
   * this the whole administrative history of every school in the database was
   * readable from any school's admin area.
   */
  schoolId?: string;
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
      ...(options.schoolId ? { schoolId: options.schoolId } : {}),
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

/**
 * Resolves which school an actor is acting for.
 *
 * The default membership is the one they are working in; a request that carries
 * an explicit school scope is authoritative and is used as given.
 */
async function resolveSchoolId(
  userId: string | null,
  given?: string | null
): Promise<string | null> {
  if (given) return given;
  if (!userId) return null;

  const membership = await prisma.schoolMembership.findFirst({
    where: { userId },
    select: { schoolId: true },
  });
  return membership?.schoolId ?? null;
}

/**
 * Records an administrative action.
 *
 * The school is resolved from the actor's membership when it is not passed, so
 * the entry is attributable without every caller having to thread the scope
 * through. An entry with no resolvable school - a system-level action - is still
 * written rather than dropped: losing the record would defeat the trail.
 */
export async function recordAuditLog(
  userId: string | null,
  action: string,
  details?: string,
  schoolId?: string | null
): Promise<void> {
  const resolvedSchoolId = await resolveSchoolId(userId, schoolId);
  await prisma.auditLog.create({
    data: { userId, action, details, schoolId: resolvedSchoolId },
  });
}
