/**
 * Class responsibility and scope.
 *
 * A teacher's rights over a class come from an explicit assignment, never from
 * being a TEACHER. A class has one main teacher and any number of assistant
 * teachers, and `ClassAssistant.canManage` records whether a given assistant may
 * manage that class or may only view it. So:
 *
 *   - the main class teacher is responsible for the class
 *   - an assistant is responsible for the same class, with the rights the school
 *     granted on that assignment
 *   - any other teacher has no access to it, however many permissions they hold
 *     globally
 *
 * This resolves identity -> role -> permission -> resource -> scope: the caller
 * must hold the permission, and must also be assigned to the class.
 */

import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../infrastructure/database';
import { requirePermissions } from '../../middleware/rbac';
import type { Permission } from '@schoolos/auth/permissions';
import { ApiError } from '../../shared/logger';

export interface ClassResponsibility {
  classId: string;
  /** The designated main or class teacher. */
  isMainTeacher: boolean;
  /** Assigned as an assistant class teacher. */
  isAssistant: boolean;
  /** Whether this assistant was granted management rights on this class. */
  canManage: boolean;
  /** Assigned to the class in either capacity, with rights to act on it. */
  hasAccess: boolean;
}

/**
 * Resolves what a user may do with a class.
 *
 * Returns null when the class does not exist, so callers do not have to
 * distinguish "no such class" from "not responsible for it" themselves.
 */
export async function resolveClassResponsibility(
  userId: string,
  classId: string
): Promise<ClassResponsibility | null> {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      teacherId: true,
      assistants: { where: { assistantId: userId }, select: { canManage: true } },
    },
  });
  if (!cls) return null;

  const isMainTeacher = cls.teacherId === userId;
  const assistant = cls.assistants[0] ?? null;
  const isAssistant = assistant !== null;
  // The main teacher always has management rights; an assistant only if the
  // school granted them on that assignment.
  const canManage = isMainTeacher || (assistant?.canManage ?? false);

  return {
    classId: cls.id,
    isMainTeacher,
    isAssistant,
    canManage,
    hasAccess: isMainTeacher || isAssistant,
  };
}

/**
 * The classes a user is responsible for.
 *
 * Used both to scope lists and to tell a teacher what they may act on, so the
 * two can never disagree.
 */
export async function assignedClassIds(userId: string): Promise<string[]> {
  const rows = await prisma.class.findMany({
    where: { OR: [{ teacherId: userId }, { assistants: { some: { assistantId: userId } } }] },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

/**
 * Route guard: requires the permission AND responsibility for the class.
 *
 * `level: 'view'` accepts either the main teacher or any assistant.
 * `level: 'manage'` additionally requires management rights, so an assistant a
 * school configured as view-only cannot perform a management operation even
 * though they are assigned to the class.
 *
 * The permission check comes first, so a caller without it is refused without
 * revealing whether the class exists.
 */
export function requireClassScope(permission: Permission, level: 'view' | 'manage' = 'view') {
  const requirePermission = requirePermissions(permission);

  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      requirePermission(req, _res, (err?: unknown) => {
        if (err) next(err);
      });
      if (_res.headersSent) return;

      const classId = req.params.classId ?? req.params.id;
      if (!classId) {
        throw new ApiError(400, 'No class was identified on this route');
      }

      const responsibility = await resolveClassResponsibility(req.user!.id, classId);
      if (!responsibility) {
        throw new ApiError(404, 'Class not found');
      }
      if (!responsibility.hasAccess) {
        throw new ApiError(
          403,
          'You are not assigned to this class. Class access comes from the class teacher or assistant class teacher assignment, not from your role.'
        );
      }
      if (level === 'manage' && !responsibility.canManage) {
        throw new ApiError(
          403,
          'You are an assistant class teacher on this class with view-only rights. Ask the main class teacher for management access.'
        );
      }

      // Attached so handlers do not resolve the same thing again.
      (req as Request & { classResponsibility?: ClassResponsibility }).classResponsibility =
        responsibility;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Reads the responsibility attached by `requireClassScope`. */
export function classResponsibilityOf(req: Request): ClassResponsibility | null {
  return (
    (req as Request & { classResponsibility?: ClassResponsibility }).classResponsibility ?? null
  );
}
