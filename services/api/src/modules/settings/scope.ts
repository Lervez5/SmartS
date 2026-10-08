import { Request } from 'express';
import { prisma } from '../../infrastructure/database';
import { ApiError } from '../../shared/logger';
import type { SchoolScope } from './types';

/**
 * Resolves the school a request may act on.
 *
 * The school always comes from the authenticated user's membership, never from
 * the request body or a query parameter. A caller cannot read or write another
 * institution's settings by supplying a different id, because the only ids this
 * accepts are the ones already attached to their account.
 */
export async function resolveSchoolScope(req: Request): Promise<SchoolScope> {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(401, 'Not authenticated');
  }

  const membership = await prisma.schoolMembership.findFirst({
    where: { userId },
    orderBy: { isDefault: 'desc' },
    include: {
      school: {
        select: { id: true, name: true, displayName: true, status: true },
      },
    },
  });

  if (!membership) {
    throw new ApiError(
      403,
      'Your account is not attached to a school. Ask a Super Admin to provision your access.'
    );
  }

  if (membership.school.status !== 'ACTIVE') {
    throw new ApiError(403, 'This school is not active.');
  }

  return {
    schoolId: membership.school.id,
    schoolName: membership.school.displayName || membership.school.name,
  };
}

/** Express middleware that attaches the resolved scope to the request. */
export function requireSchoolScope() {
  return async (req: Request, _res: unknown, next: (err?: unknown) => void): Promise<void> => {
    try {
      const scope = await resolveSchoolScope(req);
      (req as Request & { schoolScope?: SchoolScope }).schoolScope = scope;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Reads the scope attached by requireSchoolScope. */
export function schoolScopeOf(req: Request): SchoolScope {
  const scope = (req as Request & { schoolScope?: SchoolScope }).schoolScope;
  if (!scope) {
    throw new ApiError(500, 'School scope was not resolved for this request');
  }
  return scope;
}
