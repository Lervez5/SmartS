import { prisma } from '../../infrastructure/database';
import type { Prisma } from '@prisma/client';
import type { SettingsArea } from './types';

/**
 * Data access for school configuration.
 *
 * One record per area per school, so no single document grows to hold the
 * whole platform's configuration. Every query is keyed by schoolId, which the
 * scope layer has already resolved from the caller's membership.
 */

const DELEGATES = {
  general: () => prisma.schoolGeneralSettings,
  branding: () => prisma.schoolBrandingSettings,
  academic: () => prisma.schoolAcademicSettings,
  finance: () => prisma.schoolFinanceSettings,
  subscription: () => prisma.schoolSubscriptionSettings,
  notifications: () => prisma.schoolNotificationSettings,
  glow: () => prisma.schoolGlowSettings,
  security: () => prisma.schoolSecuritySettings,
} as const;

/** Reads one area, or null when the school has never saved it. */
export async function findSettings<T = unknown>(area: SettingsArea, schoolId: string) {
  const delegate = (DELEGATES[area] as () => unknown)() as {
    findUnique(args: { where: { schoolId: string } }): Promise<T | null>;
  };
  return delegate.findUnique({ where: { schoolId } });
}

/** Creates or updates one area, scoped to the school. */
export async function upsertSettings<T = unknown>(
  area: SettingsArea,
  schoolId: string,
  data: unknown
) {
  const delegate = (DELEGATES[area] as () => unknown)() as {
    upsert(args: { where: { schoolId: string }; update: unknown; create: unknown }): Promise<T>;
  };
  return delegate.upsert({
    where: { schoolId },
    update: data,
    create: { ...(data as object), schoolId },
  });
}

export const schoolRepository = {
  findById: (id: string) => prisma.school.findUnique({ where: { id } }),

  findFirst: () =>
    prisma.school.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, displayName: true, status: true },
    }),

  /** Identity fields copied onto the general settings record on first save. */
  generalIdentity: () =>
    prisma.schoolGeneralSettings.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        name: true,
        displayName: true,
        registrationNumber: true,
        schoolCode: true,
        schoolType: true,
        schoolLevel: true,
        curriculum: true,
        yearEstablished: true,
        motto: true,
        vision: true,
        mission: true,
        description: true,
      },
    }),

  members: (schoolId: string) => prisma.schoolMembership.count({ where: { schoolId } }),

  personal: {
    find: (userId: string) => prisma.userPersonalSettings.findUnique({ where: { userId } }),
    upsert: (userId: string, data: Record<string, unknown>) =>
      prisma.userPersonalSettings.upsert({
        where: { userId },
        update: data as Prisma.UserPersonalSettingsUpdateInput,
        create: { ...(data as object), userId },
      }),
  },
};
