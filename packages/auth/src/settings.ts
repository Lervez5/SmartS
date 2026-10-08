/**
 * School configuration areas.
 *
 * One list, shared by the API and all four portals, so a settings screen can
 * never exist for an area the API does not serve. The API's
 * `services/api/src/modules/settings/types.ts` re-exports from here rather than
 * declaring its own copy, and each area maps one-to-one onto an existing
 * `School*Settings` model in the Prisma schema:
 *
 *   general       -> SchoolGeneralSettings
 *   branding      -> SchoolBrandingSettings
 *   academic      -> SchoolAcademicSettings
 *   finance       -> SchoolFinanceSettings
 *   subscription  -> SchoolSubscriptionSettings
 *   notifications -> SchoolNotificationSettings
 *   glow          -> SchoolGlowSettings
 *   security      -> SchoolSecuritySettings
 *
 * These are configuration records only. Operational academic data (classes,
 * learners, courses, timetables) lives in its own models and is deliberately
 * NOT modelled as a settings area.
 */

export const SETTINGS_AREAS = [
  'general',
  'branding',
  'academic',
  'finance',
  'subscription',
  'notifications',
  'glow',
  'security',
] as const;

export type SettingsArea = (typeof SETTINGS_AREAS)[number];

export function isSettingsArea(value: unknown): value is SettingsArea {
  return typeof value === 'string' && (SETTINGS_AREAS as readonly string[]).includes(value);
}

/** Human-readable label for an area, used in navigation and page titles. */
export const SETTINGS_AREA_LABELS: Record<SettingsArea, string> = {
  general: 'General',
  branding: 'Branding',
  academic: 'Academic & CBC',
  finance: 'Finance',
  subscription: 'Subscription',
  notifications: 'Notifications',
  glow: 'Daily Glow',
  security: 'Security',
};

/**
 * What each area is for, in one line.
 *
 * The page header used to carry the same sentence for all eight areas, so it
 * told an administrator nothing about the one they had just opened. These say
 * what the area actually governs and what it affects.
 */
export const SETTINGS_AREA_DESCRIPTIONS: Record<SettingsArea, string> = {
  general: 'School identity, leadership, contact details and location.',
  branding: 'Logo, colours and the footer printed on reports and email.',
  academic: 'Terms, attendance rules, assessment weighting and CBC competency bands.',
  finance: 'Currency, invoicing, payment policy and the finance switches.',
  subscription: 'Plan and renewal details for this school’s subscription.',
  notifications: 'Delivery channels, per-event routing and quiet hours.',
  glow: 'Reserved configuration for the Daily Glow experience.',
  security: 'Password policy, lockout, sessions and transport requirements.',
};

/**
 * Permission that gates each area, matching the guards in
 * `services/api/src/modules/settings/routes.ts`. A screen may read an area with
 * a broader permission than it can write, which is why reads and writes are
 * tracked separately.
 */
export const SETTINGS_AREA_PERMISSIONS: Record<SettingsArea, { read: string; write: string }> = {
  general: { read: 'settings.view', write: 'settings.manage' },
  branding: { read: 'settings.view', write: 'settings.manage' },
  academic: { read: 'settings.view', write: 'academics.manage' },
  finance: { read: 'settings.view', write: 'finance.manage' },
  subscription: { read: 'settings.view', write: 'settings.manage' },
  notifications: { read: 'settings.view', write: 'settings.manage' },
  glow: { read: 'settings.view', write: 'settings.manage' },
  security: { read: 'settings.view', write: 'settings.manage' },
};
