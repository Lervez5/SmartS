import { z } from 'zod';

/**
 * Validation for school configuration.
 *
 * The backend is the boundary, so nothing here trusts the client: a value that
 * reaches MongoDB has passed these rules. Optional fields stay optional because
 * the school domain does not require them.
 */

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Use a hex colour such as #22c55e');

/**
 * Accepts a site-relative path as well as an absolute http(s) URL.
 *
 * An uploaded branding image is served from this origin at `/uploads/...`, not
 * from an absolute URL, so requiring `https?://` would make every uploaded logo
 * or photograph unsaveable. Relative paths are constrained to a single leading
 * slash so `//evil.example` cannot be smuggled in as a protocol-relative URL.
 */
const optionalPathOrUrl = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || /^https?:\/\/.+/i.test(v) || /^\/(?!\/)/.test(v),
    'Must be a site-relative path or an http(s) URL'
  )
  .optional();

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === '' || /^https?:\/\/.+/i.test(v), 'Must be an http(s) URL')
  .optional()
  .or(z.literal(''));

const optionalEmail = z
  .string()
  .trim()
  .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email address')
  .optional()
  .or(z.literal(''));

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || /^[+\d][\d\s()-]{6,19}$/.test(v), 'Enter a valid phone number')
  .optional()
  .or(z.literal(''));

const latitude = z.coerce
  .number()
  .min(-90)
  .max(90)
  .optional()
  .or(z.literal('').transform(() => undefined));
const longitude = z.coerce
  .number()
  .min(-180)
  .max(180)
  .optional()
  .or(z.literal('').transform(() => undefined));

export const generalSettingsSchema = z
  .object({
    // Identity
    name: z.string().trim().min(2, 'School name is required').max(160),
    displayName: z.string().trim().max(160).optional().or(z.literal('')),
    registrationNumber: z.string().trim().max(64).optional().or(z.literal('')),
    schoolCode: z
      .string()
      .trim()
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Use letters, numbers, dashes or underscores')
      .optional()
      .or(z.literal('')),
    schoolType: z.string().trim().max(64).optional().or(z.literal('')),
    schoolLevel: z.string().trim().max(64).optional().or(z.literal('')),
    curriculum: z.string().trim().max(64).optional().or(z.literal('')),
    yearEstablished: z.coerce
      .number()
      .int()
      .min(1800)
      .max(2200)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    motto: z.string().trim().max(160).optional().or(z.literal('')),
    vision: z.string().trim().max(2000).optional().or(z.literal('')),
    mission: z.string().trim().max(2000).optional().or(z.literal('')),
    description: z.string().trim().max(4000).optional().or(z.literal('')),

    // Contact
    phone: optionalPhone,
    email: optionalEmail,
    altPhone: optionalPhone,
    altEmail: optionalEmail,
    website: optionalUrl,
    admissionsEmail: optionalEmail,
    admissionsPhone: optionalPhone,
    financeEmail: optionalEmail,
    financePhone: optionalPhone,

    // Location
    country: z.string().trim().max(64).optional().or(z.literal('')),
    county: z.string().trim().max(64).optional().or(z.literal('')),
    subCounty: z.string().trim().max(64).optional().or(z.literal('')),
    town: z.string().trim().max(64).optional().or(z.literal('')),
    postalAddress: z.string().trim().max(200).optional().or(z.literal('')),
    postalCode: z.string().trim().max(32).optional().or(z.literal('')),
    physicalAddress: z.string().trim().max(300).optional().or(z.literal('')),
    latitude,
    longitude,

    // Leadership
    principalName: z.string().trim().max(120).optional().or(z.literal('')),
    principalEmail: optionalEmail,
    principalPhone: optionalPhone,
  })
  .strict();

export const brandingSettingsSchema = z
  .object({
    logoUrl: optionalPathOrUrl,
    logoAltText: z.string().trim().max(160).optional().or(z.literal('')),
    coverImageUrl: optionalPathOrUrl,
    coverImageAltText: z.string().trim().max(160).optional().or(z.literal('')),
    faviconUrl: optionalPathOrUrl,
    primaryColor: hexColor.optional().or(z.literal('')),
    secondaryColor: hexColor.optional().or(z.literal('')),
    accentColor: hexColor.optional().or(z.literal('')),
    portalNameOverride: z.string().trim().max(80).optional().or(z.literal('')),
    loginNameOverride: z.string().trim().max(80).optional().or(z.literal('')),
    reportFooter: z.string().trim().max(300).optional().or(z.literal('')),
    emailFooter: z.string().trim().max(300).optional().or(z.literal('')),
    invoiceFooter: z.string().trim().max(300).optional().or(z.literal('')),
    receiptFooter: z.string().trim().max(300).optional().or(z.literal('')),
    applyToPortals: z.boolean().default(true),
    applyToReports: z.boolean().default(true),
    applyToEmail: z.boolean().default(true),
    applyToFinance: z.boolean().default(true),
  })
  .strict();

export const academicSettingsSchema = z
  .object({
    currentAcademicYearId: z.string().trim().max(64).optional().or(z.literal('')),
    academicYearFormat: z.string().trim().max(32).optional().or(z.literal('')),
    termsPerYear: z.coerce.number().int().min(1).max(4),
    weekStart: z.coerce.number().int().min(0).max(6),
    termStartDay: z.coerce.number().int().min(1).max(28),

    attendanceRequired: z.boolean(),
    attendanceGraceMinutes: z.coerce.number().int().min(0).max(120),
    autoMarkAbsent: z.boolean(),
    allowLateArrival: z.boolean(),

    enableContinuousAssessment: z.boolean(),
    endOfTermExamWeight: z.coerce.number().int().min(0).max(100),
    continuousAssessmentWeight: z.coerce.number().int().min(0).max(100),
    minimumCompetencyLevel: z.string().trim().max(64).optional().or(z.literal('')),

    gradingSystem: z.string().trim().max(64).optional().or(z.literal('')),
    gradeScaleId: z.string().trim().max(64).optional().or(z.literal('')),
    promotionRule: z.string().trim().max(64).optional().or(z.literal('')),
    automaticPromotion: z.boolean(),

    timetablePeriodsPerDay: z.coerce.number().int().min(1).max(16),
    timetableStartTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Use HH:MM')
      .optional()
      .or(z.literal('')),
    timetableEndTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Use HH:MM')
      .optional()
      .or(z.literal('')),

    enableCompetencyFramework: z.boolean(),
    competencyLevels: z.string().optional(),
    assessmentTypes: z.string().optional(),
    rubricEnabled: z.boolean(),
    portfoliosEnabled: z.boolean(),
    evidenceTrackingEnabled: z.boolean(),
    projectsEnabled: z.boolean(),
  })
  .strict()
  .refine((v) => v.endOfTermExamWeight + v.continuousAssessmentWeight === 100, {
    message: 'Exam and continuous assessment weights must total 100',
    path: ['endOfTermExamWeight'],
  });

export const financeSettingsSchema = z
  .object({
    currency: z.string().trim().length(3, 'Use a 3-letter code such as KES').toUpperCase(),
    currencySymbol: z.string().trim().max(8).optional().or(z.literal('')),
    currencyPosition: z.enum(['before', 'after']).optional(),
    decimalPlaces: z.coerce.number().int().min(0).max(4),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),

    feeCategories: z.string().optional(),
    billingPeriod: z.string().trim().max(64).optional().or(z.literal('')),
    invoicePrefix: z.string().trim().max(16).optional().or(z.literal('')),
    receiptPrefix: z.string().trim().max(16).optional().or(z.literal('')),
    receiptFooter: z.string().trim().max(300).optional().or(z.literal('')),
    termsAndConditions: z.string().trim().max(4000).optional().or(z.literal('')),

    paymentMethods: z.string().optional(),
    allowPartialPayments: z.boolean(),
    allowOverpayment: z.boolean(),
    arrearsEnabled: z.boolean(),
    arrearsGraceDays: z.coerce.number().int().min(0).max(365),
    latePaymentPenalty: z.coerce
      .number()
      .min(0)
      .optional()
      .or(z.literal('').transform(() => undefined)),

    discountsEnabled: z.boolean(),
    waiversEnabled: z.boolean(),
    refundsEnabled: z.boolean(),
    creditNotesEnabled: z.boolean(),
    reconciliationEnabled: z.boolean(),
    financeNotificationsEnabled: z.boolean(),
  })
  .strict();

export const subscriptionSettingsSchema = z
  .object({
    planCode: z.string().trim().max(64).optional().or(z.literal('')),
    planName: z.string().trim().max(120).optional().or(z.literal('')),
    billingCycle: z.enum(['monthly', 'termly', 'annual', 'custom']).optional(),
    seats: z.coerce
      .number()
      .int()
      .min(1)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    renewsAt: z.coerce
      .date()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    status: z.enum(['trial', 'active', 'past_due', 'cancelled']).optional(),
    providerReference: z.string().trim().max(120).optional().or(z.literal('')),
    /**
     * A column on SchoolSubscriptionSettings and toggled by the subscription
     * section. It was missing here, so the toggle could never be saved.
     */
    providerConfigured: z.coerce.boolean().optional(),
  })
  .strict();

export const NOTIFICATION_EVENTS = [
  'account_activation',
  'attendance',
  'fee_payment',
  'invoice_issued',
  'arrears_notice',
  'examination_results',
  'assignment',
  'announcement',
  'parent_communication',
] as const;

export const notificationSettingsSchema = z
  .object({
    defaultChannel: z.enum(['email', 'sms', 'push', 'in_app']),
    emailEnabled: z.boolean(),
    smsEnabled: z.boolean(),
    pushEnabled: z.boolean(),
    inAppEnabled: z.boolean(),

    senderName: z.string().trim().max(120).optional().or(z.literal('')),
    senderEmail: optionalEmail,
    smsSenderId: z.string().trim().max(64).optional().or(z.literal('')),
    smsProvider: z.string().trim().max(64).optional().or(z.literal('')),
    emailProvider: z.string().trim().max(64).optional().or(z.literal('')),

    eventMatrix: z
      .record(z.string(), z.array(z.enum(['email', 'sms', 'push', 'in_app'])))
      .optional(),

    quietHoursEnabled: z.boolean(),
    quietHoursStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Use HH:MM')
      .optional()
      .or(z.literal('')),
    quietHoursEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Use HH:MM')
      .optional()
      .or(z.literal('')),
  })
  .strict()
  .refine((v) => Object.values(v).some(Boolean) || v.eventMatrix === undefined, {
    message: 'At least one notification channel must stay enabled',
    path: ['emailEnabled'],
  });

export const glowSettingsSchema = z
  .object({
    enabled: z.boolean(),
    headline: z.string().trim().max(160).optional().or(z.literal('')),
    message: z.string().trim().max(1000).optional().or(z.literal('')),
    audience: z.enum(['all', 'students', 'staff', 'parents']).optional(),
    cadence: z.enum(['daily', 'weekly', 'termly']).optional(),
    contentSources: z.string().optional(),
    /**
     * A column on SchoolGlowSettings and shown by the glow section. It was
     * missing here, so the flag could never be saved.
     */
    implemented: z.coerce.boolean().optional(),
  })
  .strict();

export const securitySettingsSchema = z
  .object({
    requireMfaForStaff: z.boolean(),
    passwordMinLength: z.coerce.number().int().min(8).max(64),
    passwordRequireUppercase: z.boolean(),
    passwordRequireNumber: z.boolean(),
    passwordRequireSymbol: z.boolean(),
    passwordExpiryDays: z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    maxFailedLogins: z.coerce.number().int().min(1).max(20),
    lockoutMinutes: z.coerce.number().int().min(1).max(1440),
    sessionTimeoutMinutes: z.coerce.number().int().min(5).max(10080),
    requireActivation: z.boolean(),
    allowPasswordReset: z.boolean(),
    passwordResetExpiryMinutes: z.coerce.number().int().min(5).max(1440),
    enforceHttps: z.boolean(),
  })
  .strict();

/** Personal preferences. Never contains school configuration. */
/**
 * Personal preferences. The toggles carry defaults so a client can send a
 * partial update without having to restate every preference it is not changing.
 */
export const personalSettingsSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    language: z.string().trim().max(16).optional(),
    timezone: z.string().trim().max(64).optional(),
    dateFormat: z.string().trim().max(32).optional(),
    currency: z.string().trim().length(3).optional(),
    emailNotifications: z.boolean().default(true),
    smsNotifications: z.boolean().default(false),
    pushNotifications: z.boolean().default(false),
    inAppNotifications: z.boolean().default(true),
    marketingOptIn: z.boolean().default(false),
    profileVisibility: z.enum(['private', 'school', 'public']).default('private'),
    teachingPreferences: z.string().optional(),
    communicationPreferences: z.string().optional(),
    learningPreferences: z.string().optional(),
  })
  .strict();

export const SCHEMAS = {
  general: generalSettingsSchema,
  branding: brandingSettingsSchema,
  academic: academicSettingsSchema,
  finance: financeSettingsSchema,
  subscription: subscriptionSettingsSchema,
  notifications: notificationSettingsSchema,
  glow: glowSettingsSchema,
  security: securitySettingsSchema,
} as const;

export type GeneralSettingsDto = z.infer<typeof generalSettingsSchema>;
export type BrandingSettingsDto = z.infer<typeof brandingSettingsSchema>;
export type AcademicSettingsDto = z.infer<typeof academicSettingsSchema>;
export type FinanceSettingsDto = z.infer<typeof financeSettingsSchema>;
export type SubscriptionSettingsDto = z.infer<typeof subscriptionSettingsSchema>;
export type NotificationSettingsDto = z.infer<typeof notificationSettingsSchema>;
export type GlowSettingsDto = z.infer<typeof glowSettingsSchema>;
export type SecuritySettingsDto = z.infer<typeof securitySettingsSchema>;
export type PersonalSettingsDto = z.infer<typeof personalSettingsSchema>;
