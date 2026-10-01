import { prisma } from '../../infrastructure/database';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';
import { findSettings, upsertSettings, schoolRepository } from './repository';
import { SCHEMAS, NOTIFICATION_EVENTS, type PersonalSettingsDto } from './schema';
import { SETTINGS_AREAS, type SettingsArea } from './types';

/**
 * Sensible starting points so a first save produces a complete record rather
 * than a wall of nulls. These configure behaviour only; they hold no
 * operational data.
 */
const DEFAULTS: Record<SettingsArea, Record<string, unknown>> = {
  general: {
    name: '',
  },
  branding: {
    applyToPortals: true,
    applyToReports: true,
    applyToEmail: true,
    applyToFinance: true,
  },
  academic: {
    termsPerYear: 3,
    weekStart: 1,
    termStartDay: 1,
    attendanceRequired: true,
    attendanceGraceMinutes: 15,
    autoMarkAbsent: false,
    allowLateArrival: true,
    enableContinuousAssessment: false,
    endOfTermExamWeight: 70,
    continuousAssessmentWeight: 30,
    automaticPromotion: false,
    timetablePeriodsPerDay: 8,
    enableCompetencyFramework: false,
    rubricEnabled: false,
    portfoliosEnabled: false,
    evidenceTrackingEnabled: false,
    projectsEnabled: false,
  },
  finance: {
    currency: 'KES',
    decimalPlaces: 2,
    fiscalYearStartMonth: 1,
    allowPartialPayments: true,
    allowOverpayment: false,
    arrearsEnabled: true,
    arrearsGraceDays: 14,
    discountsEnabled: false,
    waiversEnabled: false,
    refundsEnabled: false,
    creditNotesEnabled: false,
    reconciliationEnabled: true,
    financeNotificationsEnabled: true,
  },
  subscription: {
    providerConfigured: false,
    implemented: false,
  },
  notifications: {
    defaultChannel: 'in_app',
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
    inAppEnabled: true,
    quietHoursEnabled: false,
    eventMatrix: Object.fromEntries(NOTIFICATION_EVENTS.map((event) => [event, ['in_app']])),
  },
  glow: {
    enabled: false,
    implemented: false,
  },
  security: {
    requireMfaForStaff: false,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSymbol: false,
    maxFailedLogins: 5,
    lockoutMinutes: 15,
    sessionTimeoutMinutes: 480,
    requireActivation: true,
    allowPasswordReset: true,
    passwordResetExpiryMinutes: 30,
    enforceHttps: true,
  },
};

function withDefaults(area: SettingsArea, record: unknown): unknown {
  return { ...DEFAULTS[area], ...(record as object) };
}

/** Reads one configuration area, falling back to defaults. */
export async function getSettings(area: SettingsArea, schoolId: string) {
  if (!SETTINGS_AREAS.includes(area)) {
    throw new ApiError(404, `Unknown settings area "${area}"`);
  }
  const record = await findSettings(area, schoolId);
  return {
    area,
    saved: record !== null,
    settings: withDefaults(area, record),
  };
}

/** Reads every area, used to hydrate the whole Settings workspace at once. */
export async function getAllSettings(schoolId: string) {
  const entries = await Promise.all(
    SETTINGS_AREAS.map(async (area) => [area, await getSettings(area, schoolId)] as const)
  );
  return Object.fromEntries(entries);
}

/** Fields that must never reach an audit entry. */
const NEVER_AUDIT = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
]);

function auditSafe(area: SettingsArea, before: unknown, after: unknown) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const changed = Object.keys(a).filter(
    (k) => !NEVER_AUDIT.has(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k])
  );
  return { area, changedFields: changed };
}

/**
 * Validates and persists one area.
 *
 * Validation runs here rather than being trusted from the client, and the
 * write is confirmed before returning: a caller only sees a success response
 * when MongoDB accepted the change.
 */
export async function updateSettings(
  actorId: string,
  schoolId: string,
  schoolName: string,
  area: SettingsArea,
  input: unknown
) {
  const schema = SCHEMAS[area];
  if (!schema) {
    throw new ApiError(404, `Unknown settings area "${area}"`);
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(422, 'Some settings are not valid', parsed.error.flatten());
  }

  const before = await findSettings(area, schoolId);

  // The school's canonical name lives on the School record too, so portals and
  // reports that read the institution directly stay in step.
  if (area === 'general') {
    const g = parsed.data as { name: string; displayName?: string };
    await prisma.school.update({
      where: { id: schoolId },
      data: { name: g.name, displayName: g.displayName || g.name },
    });
  }

  const saved = await upsertSettings(area, schoolId, parsed.data);

  // Confirm the write landed; never report success on an unconfirmed write.
  const confirmed = await findSettings(area, schoolId);
  if (!confirmed) {
    throw new ApiError(500, 'The change could not be confirmed and was not saved.');
  }

  await recordAuditLog(
    actorId,
    'UPDATE_SCHOOL_SETTINGS',
    JSON.stringify(auditSafe(area, before, parsed.data))
  );
  void schoolName;

  return { area, saved: true, settings: withDefaults(area, confirmed) };
}

/** Everything the rest of the platform needs to brand a document. */
/**
 * The school the sign-in screen renders for.
 *
 * The platform provisions exactly one school, so this is the first ACTIVE
 * record. A multi-tenant deployment would resolve this from the request host
 * instead of guessing.
 */
export async function resolveFirstActiveSchool() {
  return prisma.school.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Display metadata for the unauthenticated sign-in screen.
 *
 * Read directly rather than through `getPublicBranding`, because that projection
 * is scoped by `requireSchoolScope` and does not include the academic session
 * the login badge shows. Kept to display values only - see the note in
 * src/modules/public/index.ts before adding anything here.
 */
export async function getSignInBranding(schoolId: string) {
  const [school, branding, academic] = await Promise.all([
    schoolRepository.findById(schoolId),
    findSettings('branding', schoolId),
    findSettings('academic', schoolId),
  ]);
  if (!school) return null;

  const b = (withDefaults('branding', branding) ?? {}) as Record<string, unknown>;
  const a = (withDefaults('academic', academic) ?? {}) as Record<string, unknown>;

  return {
    schoolId: school.id,
    name: school.name,
    displayName: (b.portalNameOverride as string) || school.displayName || school.name,
    curriculum: school.curriculum || null,
    logoUrl: (b.logoUrl as string) || null,
    faviconUrl: (b.faviconUrl as string) || null,
    primaryColor: (b.primaryColor as string) || null,
    /** A configured free-text academic session, used for the login badge. */
    academicSession: (a.currentAcademicYearId as string) || null,
  };
}

export async function getPublicBranding(schoolId: string) {
  const [school, branding] = await Promise.all([
    schoolRepository.findById(schoolId),
    findSettings('branding', schoolId),
  ]);
  if (!school) return null;

  const b = (withDefaults('branding', branding) ?? {}) as Record<string, unknown>;
  return {
    schoolId: school.id,
    name: school.name,
    displayName: school.displayName || school.name,
    logoUrl: (b.logoUrl as string) || null,
    faviconUrl: (b.faviconUrl as string) || null,
    primaryColor: (b.primaryColor as string) || null,
    secondaryColor: (b.secondaryColor as string) || null,
    accentColor: (b.accentColor as string) || null,
    applyToPortals: Boolean(b.applyToPortals),
  };
}

/** Read-only school identity for portals, reports and communications. */
export async function getPublicIdentity(schoolId: string) {
  const general = await findSettings('general', schoolId);
  const g = (withDefaults('general', general) ?? {}) as Record<string, unknown>;
  return {
    name: g.name || null,
    displayName: g.displayName || (g.name as string) || null,
    motto: g.motto || null,
    email: g.email || null,
    phone: g.phone || null,
    website: g.website || null,
    town: g.town || null,
    county: g.county || null,
    country: g.country || null,
  };
}

/* ------------------------------------------------------------------ *
 * Personal settings - per user, never school scoped.
 * ------------------------------------------------------------------ */

export async function getPersonalSettings(userId: string) {
  const record = await schoolRepository.personal.find(userId);
  return record ?? { userId };
}

export async function updatePersonalSettings(userId: string, input: unknown) {
  const { personalSettingsSchema } = await import('./schema');
  const parsed = personalSettingsSchema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(422, 'Some preferences are not valid', parsed.error.flatten());
  }
  const saved = await schoolRepository.personal.upsert(userId, parsed.data);
  return { userId: saved.userId, settings: saved };
}

export type { PersonalSettingsDto };
