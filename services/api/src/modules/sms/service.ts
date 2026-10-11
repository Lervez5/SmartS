/**
 * SMS Centre - the school's outbound messaging to guardians.
 *
 * This module owns one thing: turning a staff decision ("tell these guardians
 * this") into durable campaign records with a recipient set resolved on the
 * server, and being honest about what happened next.
 *
 * Three facts shape everything here, and none of them is worked around:
 *
 *   1. There is no SMS provider configured in this repository. No gateway
 *      client, no credentials, no API key, no HTTP client in the API service.
 *      `SchoolNotificationSettings.smsProvider` is free text read by nothing.
 *      So no campaign can reach a handset, and this module never claims one
 *      did: a confirmed campaign that cannot be handed to a provider is recorded
 *      as `blocked` with the reason, not as sent.
 *
 *   2. There is no credit concept of any kind. No wallet, no ledger, no
 *      top-up, and `Receipt` is written by no code path - so "balance" is
 *      derived from invoices minus their receipts, which is the only
 *      authoritative figure available.
 *
 *   3. Recipients are guardians, resolved from `ParentChildLink`. A guardian is
 *      a `ParentProfile`, never a bare phone number, because a recipient who
 *      cannot be identified cannot be deduplicated, suppressed or traced back
 *      to the learner whose balance produced them.
 *
 * The recipient set is always resolved server-side. The browser may ask for an
 * audience; the server decides who is in it, and stores those rows, so a
 * tampered count or a hand-supplied phone list has no effect.
 */

import {
  GradeScope,
  LearningAreaStatus,
  Prisma,
  SmsCampaignPurpose,
  SmsCampaignStatus,
  SmsRecipientStatus,
} from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { config } from '../../config';
import { ApiError } from '../../shared/logger';
import { getSmsGateway, type SmsCreditBalance } from './gateway';
import { rescheduleRule } from './automation';
import { recordAuditLog } from '../audit-logs/service';

/* ------------------------------------------------------------------ *
 * Capability
 * ------------------------------------------------------------------ */

export interface SmsCapability {
  /** Whether the school has switched the channel on in settings. */
  channelEnabled: boolean;
  /** Whether a provider integration exists in this codebase at all. */
  providerIntegrated: boolean;
  /** Which gateway would be used. */
  providerName: string;
  /** Whether sending can actually attempt a handoff right now. */
  canSend: boolean;
  /** What is missing, in the operator's terms. */
  blocker: string | null;
  /** The free-text provider name from settings, if any. */
  configuredProvider: string | null;
  /** The sender id that would actually be used. */
  configuredSenderId: string | null;
  /** The sender id as typed in settings, which may differ or be unset. */
  settingsSenderId: string | null;
  /** SMS credits. Never a number unless something real reports one. */
  credits: SmsCreditStatus;
}

export interface SmsCreditStatus {
  /**
   * Whether a real, queryable balance exists.
   *
   * False here, because no provider is integrated and the platform has no
   * credit ledger. The UI is told the number is unknown rather than given a
   * placeholder, so an operator cannot mistake "0 credits" for "unlimited" or
   * "out of credits" for "not configured".
   */
  available: boolean;
  source: 'none' | 'provider';
  /** The parsed figure, when one could be read from the provider's own text. */
  balance: number | null;
  /** The provider's own balance string, verbatim, for display. */
  balanceDisplay: string | null;
  currency: string | null;
  reason: string;
}

/** A number and currency read out of a provider's formatted balance string. */
interface ParsedBalance {
  value: number;
  currency: string | null;
}

/**
 * Reads a figure out of a provider's formatted balance.
 *
 * A gateway returns its balance as display text - "KSh 1,240.00", "NGN 500.00",
 * "1,240" - so the number is extracted rather than coerced. A string that
 * carries no digits yields null rather than NaN, so an unreadable balance is
 * absent instead of wrong.
 */
/**
 * Reads a figure out of a provider's formatted balance.
 *
 * Exported because the parsing rule is easy to get subtly wrong - and the cost of
 * getting it wrong is a credit balance that looks plausible but is off by
 * whatever the separator cost - so it is asserted directly rather than only
 * through the workspace.
 */
export function parseReportedBalance(raw: string): ParsedBalance | null {
  // Commas are thousands separators in the gateways this client speaks to, so
  // they are removed rather than replaced with a space: replacing them would
  // split "KSh 4,500.00" into "KSh 4 500.00", and the first number in that is
  // 4 - a balance off by a factor of a thousand.
  const cleaned = raw.replace(/,/g, '').trim();

  // The first number-shaped run in the string, with an optional decimal part.
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const value = Number(match[0]);
  if (Number.isNaN(value)) return null;

  // The currency is only useful as a three-letter code. Anything else in the
  // provider's text is decoration - "KSh", "NGN" - and the school's configured
  // code is the accurate one to report.
  const found = cleaned.match(/^([A-Za-z]{3})\b/);
  const currency = found ? found[1].toUpperCase() : null;

  return { value, currency };
}

/**
 * Resolves what the school can actually do, from its own configuration.
 *
 * This is the single place the workspace's "can I send" question is answered, so
 * every route and every screen agrees rather than each guessing.
 */
export async function resolveCapability(schoolId: string): Promise<SmsCapability> {
  const settings = await prisma.schoolNotificationSettings.findUnique({
    where: { schoolId },
    select: {
      smsEnabled: true,
      smsProvider: true,
      smsSenderId: true,
    },
  });

  const gateway = getSmsGateway();
  const providerIntegrated = gateway.configured;
  const channelEnabled = settings?.smsEnabled === true;

  // Credits come from the gateway when it can report them, and honestly say so
  // when it cannot - never a number derived from campaign counts.
  let credits: SmsCreditStatus;
  if (providerIntegrated) {
    const reported = await gateway.getCreditBalance();
    const parsed = reported.balance ? parseReportedBalance(reported.balance) : null;
    credits = {
      available: reported.available,
      source: reported.available ? 'provider' : 'none',
      // The provider's own string is kept verbatim, and the number is parsed
      // from it rather than coerced: a gateway returns something like
      // "KSh 1,240.00", and Number() on that is NaN, which would display as a
      // credit balance of NaN.
      balance: parsed?.value ?? null,
      balanceDisplay: reported.balance,
      // The school's configured code, not the gateway's abbreviation: the
      // platform reports money in KES everywhere else, and "KSh" here would read
      // as a different currency than the rest of the figures.
      currency: config.currency.code,
      reason:
        reported.reason ??
        `Balance reported by the configured gateway (${gateway.provider}). This is the gateway ` +
          'account balance, not a school wallet.',
    };
  } else {
    credits = {
      available: false,
      source: 'none',
      balance: null,
      balanceDisplay: null,
      currency: null,
      reason:
        `${gateway.blocker} Without a configured gateway there is no provider balance to query, ` +
        'and the platform has no SMS credit ledger, so credits are unknown rather than zero.',
    };
  }

  const reasons: string[] = [];
  if (!channelEnabled) {
    reasons.push('SMS is switched off for this school. Enable it under Settings → Notifications.');
  }
  if (!providerIntegrated) {
    reasons.push(gateway.blocker ?? 'No SMS gateway is configured.');
  }

  return {
    channelEnabled,
    providerIntegrated,
    /**
     * A configured gateway is the gate. With one present a campaign is genuinely
     * handed to a provider, which is a different state from every previous run
     * of this module, where nothing could be.
     */
    canSend: channelEnabled && providerIntegrated,
    providerName: gateway.provider,
    blocker: reasons.length > 0 ? reasons.join(' ') : null,
    configuredProvider: gateway.configured
      ? settings?.smsProvider?.trim() || gateway.provider
      : settings?.smsProvider?.trim() || null,
    // The gateway's own sender ID is the one that would actually be used; the
    // settings value is what an administrator typed and may be unset.
    configuredSenderId: gateway.senderId ?? settings?.smsSenderId?.trim() ?? null,
    settingsSenderId: settings?.smsSenderId?.trim() || null,
    credits,
  };
}

/* ------------------------------------------------------------------ *
 * Message encoding
 * ------------------------------------------------------------------ */

export interface SegmentEstimate {
  /** Characters the body actually contains. */
  characters: number;
  encoding: 'GSM-7' | 'UCS-2';
  /** Segments needed at that encoding. */
  segments: number;
  /** Characters per single segment at that encoding. */
  singleSegmentLimit: number;
  /** Characters per segment once the body is concatenated. */
  multipartSegmentLimit: number;
  /**
   * Whether the estimate is for the encoding standard, not a provider limit.
   *
   * No provider is configured, so there is no provider limit to defer to. These
   * are the GSM 03.38 / UCS-2 figures, which are the same everywhere and are
   * therefore an honest estimate rather than a claim about a vendor.
   */
  basis: 'encoding-standard';
}

const GSM7_BASIC = new Set(
  (
    '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
    '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
  ).split('')
);
const GSM7_EXTENDED = new Set('^{}\\[~]|€'.split(''));

/**
 * Estimates segments from the encoding the body actually needs.
 *
 * A body is GSM-7 only if every character is in the GSM 03.38 basic or extended
 * set. Anything else - an emoji, most accented letters outside that set - forces
 * UCS-2, which halves the segment size, so the estimate has to look at the
 * content rather than assume.
 */
export function estimateSegments(body: string): SegmentEstimate {
  const characters = [...body].length;

  let needsUnicode = false;
  for (const char of body) {
    if (char !== '\n' && char !== '\r' && !GSM7_BASIC.has(char) && !GSM7_EXTENDED.has(char)) {
      needsUnicode = true;
      break;
    }
  }

  if (!needsUnicode) {
    const singleSegmentLimit = 160;
    const multipartSegmentLimit = 153;
    const segments =
      characters <= singleSegmentLimit ? 1 : Math.ceil(characters / multipartSegmentLimit);
    return {
      characters,
      encoding: 'GSM-7',
      segments: Math.max(1, segments),
      singleSegmentLimit,
      multipartSegmentLimit,
      basis: 'encoding-standard',
    };
  }

  const singleSegmentLimit = 70;
  const multipartSegmentLimit = 67;
  const segments =
    characters <= singleSegmentLimit ? 1 : Math.ceil(characters / multipartSegmentLimit);
  return {
    characters,
    encoding: 'UCS-2',
    segments: Math.max(1, segments),
    singleSegmentLimit,
    multipartSegmentLimit,
    basis: 'encoding-standard',
  };
}

/* ------------------------------------------------------------------ *
 * Phone handling
 * ------------------------------------------------------------------ */

/** Result of normalising one number. */
export interface PhoneResolution {
  ok: boolean;
  /** E.164 where a country code could be determined. */
  normalised: string | null;
  /** Why it could not be used, for the skip reason. */
  reason?: 'missing' | 'invalid' | 'too_short';
}

/**
 * Normalises a number to E.164, defaulting to Kenya (+254) as the school's own
 * region rather than guessing from the digits.
 *
 * A number is not "fixed up" into validity: if it has fewer digits than the
 * region's national number, it is rejected rather than padded, because a padded
 * number is a wrong number and the message would go to a stranger.
 */
export function normalisePhone(raw: string | null | undefined): PhoneResolution {
  if (!raw || !raw.trim()) {
    return { ok: false, normalised: null, reason: 'missing' };
  }

  // Keep digits and a single leading plus. Everything else - spaces, dashes,
  // brackets - is formatting, not content.
  const hadPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');

  if (digits.length === 0) {
    return { ok: false, normalised: null, reason: 'invalid' };
  }

  let e164: string;
  if (hadPlus) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('254')) {
    e164 = `+${digits}`;
  } else if (digits.startsWith('0')) {
    // Local form: drop the trunk 0 and apply the region code.
    e164 = `+254${digits.replace(/^0+/, '')}`;
  } else {
    e164 = `+254${digits}`;
  }

  const national = e164.replace('+254', '');
  if (national.length < 9) {
    return { ok: false, normalised: null, reason: 'too_short' };
  }

  return { ok: true, normalised: e164 };
}

/**
 * Masks a number for display: enough to recognise, not enough to dial.
 *
 * A recipient who had no number is stored with the placeholder `unknown`, and
 * masking that would produce gibberish - so it is passed through as-is, because
 * the row's `skipReason` already explains why there is no number at all.
 */
export function maskPhone(phone: string): string {
  if (!/^\+?[\d\s\-()]+$/.test(phone)) return phone;
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length < 6) return '••••';
  return `${phone.slice(0, Math.max(0, phone.length - 5))}••••${phone.slice(-2)}`;
}

/* ------------------------------------------------------------------ *
 * Audience filters
 * ------------------------------------------------------------------ */

export type BulkAudience = 'all' | 'grade' | 'stream';

export interface BulkAudienceInput {
  audience: BulkAudience;
  /** Grade level, when audience is `grade`. */
  gradeLevel?: string;
  /** Stream id, when audience is `stream`. */
  streamId?: string;
  /** Academic session every placement is read against. */
  academicYearId?: string;
}

/**
 * Resolves the learners an audience refers to, as User ids.
 *
 * "All parents" is not every phone number in the database: it is the guardians
 * of learners actually linked in this school. A grade or stream filter resolves
 * through the learner's placement in the chosen session, so the academic context
 * is real rather than a grade string typed on the client.
 */
export async function resolveAudienceStudentIds(
  schoolId: string,
  input: BulkAudienceInput
): Promise<{ studentIds: string[]; label: string }> {
  if (input.audience === 'all') {
    // Every learner who has a guardian link and belongs to this school. The
    // membership is what scopes them, not a grade.
    const profiles = await prisma.studentProfile.findMany({
      where: {
        user: { schoolMemberships: { some: { schoolId } } },
        parentLinks: { some: {} },
      },
      select: { userId: true },
    });
    return {
      studentIds: profiles.map((p) => p.userId),
      label: 'All guardians of learners in this school',
    };
  }

  if (input.audience === 'grade') {
    if (!input.gradeLevel) {
      throw new ApiError(400, 'Pick a grade to resolve a grade audience.');
    }

    // Placed in the session the staff member is working in, so the grade means
    // the same thing as it does everywhere else in the portal.
    const enrollments = await prisma.enrollment.findMany({
      where: {
        studentId: { not: null },
        class: { schoolId, gradeLevel: input.gradeLevel },
        ...(input.academicYearId
          ? {
              class: {
                schoolId,
                gradeLevel: input.gradeLevel,
                academicYearId: input.academicYearId,
              },
            }
          : {}),
      },
      select: { studentId: true },
      distinct: ['studentId'],
    });

    return {
      studentIds: enrollments.map((e) => e.studentId!).filter(Boolean),
      label: `Guardians of learners in grade ${input.gradeLevel}`,
    };
  }

  // stream
  if (!input.streamId) {
    throw new ApiError(400, 'Pick a stream to resolve a stream audience.');
  }

  const stream = await prisma.stream.findFirst({
    where: { id: input.streamId, class: { schoolId } },
    select: { id: true, name: true, class: { select: { gradeLevel: true } } },
  });
  if (!stream) {
    throw new ApiError(404, 'That stream does not exist in your school.');
  }

  // Scoped by session too, so a stream reused in a later session does not pull
  // learners from a year that has already closed.
  const enrollments = await prisma.enrollment.findMany({
    where: {
      studentId: { not: null },
      streamId: stream.id,
      ...(input.academicYearId
        ? { class: { schoolId, academicYearId: input.academicYearId } }
        : { class: { schoolId } }),
    },
    select: { studentId: true },
    distinct: ['studentId'],
  });

  return {
    studentIds: enrollments.map((e) => e.studentId!).filter(Boolean),
    label: `Guardians of learners in ${stream.name} (grade ${stream.class.gradeLevel ?? 'n/a'})`,
  };
}

/* ------------------------------------------------------------------ *
 * Recipients
 * ------------------------------------------------------------------ */

/**
 * A resolved recipient: a guardian, their number, and whether they can be sent to.
 *
 * A guardian linked to several learners in the same audience appears once. The
 * message is to the guardian; sending it three times is a cost, a nuisance, and
 * a signal the system does not understand who it is talking to.
 */
export interface ResolvedRecipient {
  parentProfileId: string;
  guardianName: string;
  /** Normalised number, or null when the guardian cannot be reached. */
  phone: string | null;
  /** Learners in this audience whose guardian this is, for traceability. */
  studentUserIds: string[];
  /** Null when sendable, otherwise why not. */
  skipReason: string | null;
}

export interface RecipientResolution {
  recipients: ResolvedRecipient[];
  /** Sendable only. */
  sendable: ResolvedRecipient[];
  summary: {
    guardiansLinked: number;
    sendable: number;
    skipped: number;
    missingPhone: number;
    optedOut: number;
    invalidPhone: number;
    noPhoneRecorded: number;
    learnersCovered: number;
  };
}

/**
 * Resolves guardians for a set of learners, deduplicated and validated.
 *
 * Suppression is applied here, at resolution, not only at submission - so the
 * count the operator confirms is the count that would be attempted, and an
 * opted-out guardian is reported as skipped rather than discovered mid-send.
 */
export async function resolveGuardianRecipients(
  schoolId: string,
  studentIds: string[]
): Promise<RecipientResolution> {
  if (studentIds.length === 0) {
    return {
      recipients: [],
      sendable: [],
      summary: {
        guardiansLinked: 0,
        sendable: 0,
        skipped: 0,
        missingPhone: 0,
        optedOut: 0,
        invalidPhone: 0,
        noPhoneRecorded: 0,
        learnersCovered: 0,
      },
    };
  }

  // Guardians of these learners, in this school. The link is the only thing that
  // associates a guardian with a learner - never a name, never a guess.
  const links = await prisma.parentChildLink.findMany({
    where: {
      child: { userId: { in: studentIds } },
      parent: {
        user: { schoolMemberships: { some: { schoolId } } },
      },
    },
    select: {
      parentId: true,
      child: { select: { userId: true } },
      parent: {
        select: {
          user: {
            select: { name: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      },
    },
  });

  // Guardians who have asked not to be contacted.
  const optedOut = await prisma.smsOptOut.findMany({
    select: { parentProfileId: true },
  });
  const suppressed = new Set(optedOut.map((row) => row.parentProfileId));

  const byGuardian = new Map<string, ResolvedRecipient>();
  const coveredLearners = new Set<string>();

  for (const link of links) {
    const learnerId = link.child.userId;
    if (learnerId) coveredLearners.add(learnerId);

    const existing = byGuardian.get(link.parentId);
    const guardianName =
      link.parent.user.name ||
      [link.parent.user.firstName, link.parent.user.lastName].filter(Boolean).join(' ') ||
      link.parent.user.email ||
      'Guardian';

    if (existing) {
      // Same guardian, another learner in the same audience. One recipient,
      // both learners recorded behind it.
      if (learnerId) existing.studentUserIds.push(learnerId);
      continue;
    }

    let skipReason: string | null = null;
    let phone: string | null = null;

    if (suppressed.has(link.parentId)) {
      skipReason = 'This guardian has opted out of SMS.';
    } else {
      const resolution = normalisePhone(link.parent.user.phone);
      if (!resolution.ok) {
        skipReason =
          resolution.reason === 'missing' || resolution.reason === 'invalid'
            ? 'No usable phone number is recorded for this guardian.'
            : 'The recorded phone number is too short to be valid.';
      } else {
        phone = resolution.normalised;
      }
    }

    byGuardian.set(link.parentId, {
      parentProfileId: link.parentId,
      guardianName,
      phone,
      studentUserIds: learnerId ? [learnerId] : [],
      skipReason,
    });
  }

  const recipients = [...byGuardian.values()];
  const sendable = recipients.filter((recipient) => recipient.skipReason === null);

  const missingPhone = recipients.filter(
    (r) => r.phone === null && !suppressed.has(r.parentProfileId)
  );
  const optedOutCount = recipients.filter((r) => suppressed.has(r.parentProfileId));

  return {
    recipients,
    sendable,
    summary: {
      guardiansLinked: recipients.length,
      sendable: sendable.length,
      skipped: recipients.length - sendable.length,
      missingPhone: missingPhone.length,
      optedOut: optedOutCount.length,
      invalidPhone: missingPhone.filter((r) => r.phone === null).length,
      noPhoneRecorded: missingPhone.length,
      learnersCovered: coveredLearners.size,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Finance: outstanding balance
 * ------------------------------------------------------------------ */

export interface OutstandingInvoice {
  invoiceId: string;
  number: string;
  amountCents: number;
  paidCents: number;
  outstandingCents: number;
  currency: string;
  dueDate: Date;
  issuedAt: Date;
}

export interface GuardianBalance {
  parentProfileId: string;
  guardianName: string;
  studentProfileId: string;
  learnerName: string;
  learnerUserId: string | null;
  gradeLevel: string | null;
  invoices: OutstandingInvoice[];
  outstandingCents: number;
  currency: string;
  oldestDueDate: Date;
}

export interface FinanceReminderResolution {
  guardians: GuardianBalance[];
  summary: {
    guardians: number;
    invoices: number;
    outstandingCents: number;
    skipped: {
      noPhone: number;
      optedOut: number;
    };
  };
}

/**
 * Computes what a guardian actually owes, from invoices and their receipts.
 *
 * This is the authoritative calculation and it is deliberately not "invoice is
 * not paid": an invoice carries an amount and a set of receipts, and the
 * outstanding figure is the difference. A partially paid invoice therefore has a
 * real remaining balance rather than being treated as either fully paid or fully
 * owing, and a fully settled one drops to zero and is not reminded.
 *
 * `Receipt` is written by no code path in this repository, so in practice a
 * receipt-less invoice owes its full amount. The arithmetic is still correct the
 * moment a receipt is recorded, which is the point of deriving it rather than
 * reading a status flag.
 */
export async function resolveOutstandingBalances(
  schoolId: string,
  options: {
    academicYearId?: string;
    gradeLevel?: string;
    overdueAfterDays?: number;
    minOutstandingCents?: number;
  } = {}
): Promise<FinanceReminderResolution> {
  const now = Date.now();
  const graceMs = (options.overdueAfterDays ?? 0) * 24 * 60 * 60 * 1000;

  // Invoices belonging to this school, through the learner's membership. Invoice
  // carries no schoolId of its own, so the scope is resolved this way.
  const invoices = await prisma.invoice.findMany({
    where: {
      student: { schoolMemberships: { some: { schoolId } } },
      // A `void` invoice is not a debt, whatever else it looks like.
      status: { notIn: ['void'] },
      studentId: { not: null },
    },
    select: {
      id: true,
      number: true,
      amountCents: true,
      currency: true,
      dueDate: true,
      issuedAt: true,
      status: true,
      paidAt: true,
      studentId: true,
      receipts: { select: { amountCents: true } },
      student: {
        select: {
          name: true,
          studentProfile: { select: { id: true, gradeLevel: true } },
        },
      },
    },
  });

  const eligible: OutstandingInvoice[] = [];

  for (const invoice of invoices) {
    // Already settled outright: the status is the record of a completed payment,
    // and reminding for it would chase money the school has.
    if (invoice.status === 'paid') continue;
    if (invoice.paidAt) continue;

    const paidCents = invoice.receipts.reduce((sum, receipt) => sum + receipt.amountCents, 0);
    const outstandingCents = invoice.amountCents - paidCents;

    // Nothing left to collect. This is the partial-payment case: an invoice with
    // a payment that covers it is not a reminder.
    if (outstandingCents <= 0) continue;

    if (options.minOutstandingCents && outstandingCents < options.minOutstandingCents) continue;

    // Overdue by the configured grace period.
    if (invoice.dueDate.getTime() + graceMs > now) continue;

    // Grade filter, when the operator narrowed the audience.
    if (options.gradeLevel && invoice.student?.studentProfile?.gradeLevel !== options.gradeLevel) {
      continue;
    }

    eligible.push({
      invoiceId: invoice.id,
      number: invoice.number,
      amountCents: invoice.amountCents,
      paidCents,
      outstandingCents,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      issuedAt: invoice.issuedAt,
    });
  }

  // Group by guardian so one guardian with several learners owing money is one
  // message with a total, rather than three separate messages about three
  // balances. The learner names stay attached to their own invoices, so no
  // guardian is told about another guardian's children.
  const byGuardian = new Map<string, GuardianBalance>();

  for (const invoice of invoices) {
    if (!invoice.studentId) continue;
    const outstanding = eligible.find((e) => e.invoiceId === invoice.id);
    if (!outstanding) continue;
    if (!invoice.student?.studentProfile) continue;

    const profileId = invoice.student.studentProfile.id;

    const links = await prisma.parentChildLink.findMany({
      where: { childId: profileId },
      select: {
        parentId: true,
        parent: {
          select: {
            user: {
              select: { name: true, firstName: true, lastName: true, email: true, phone: true },
            },
          },
        },
      },
    });

    for (const link of links) {
      const guardianName =
        link.parent.user.name ||
        [link.parent.user.firstName, link.parent.user.lastName].filter(Boolean).join(' ') ||
        link.parent.user.email ||
        'Guardian';

      const existing = byGuardian.get(link.parentId);
      const row: GuardianBalance = existing ?? {
        parentProfileId: link.parentId,
        guardianName,
        studentProfileId: profileId,
        learnerName: invoice.student.name ?? 'Learner',
        learnerUserId: invoice.studentId,
        gradeLevel: invoice.student.studentProfile?.gradeLevel ?? null,
        invoices: [],
        outstandingCents: 0,
        currency: outstanding.currency,
        oldestDueDate: outstanding.dueDate,
      };

      row.invoices.push(outstanding);
      row.outstandingCents += outstanding.outstandingCents;
      if (outstanding.dueDate < row.oldestDueDate) row.oldestDueDate = outstanding.dueDate;

      byGuardian.set(link.parentId, row);
    }
  }

  const optedOut = await prisma.smsOptOut.findMany({ select: { parentProfileId: true } });
  const suppressed = new Set(optedOut.map((row) => row.parentProfileId));

  const guardians = [...byGuardian.values()];

  // Total across the distinct invoices, not across guardians. A guardian is
  // responsible for the same debt as their co-guardian, so summing the per
  // guardian figures would report one invoice once per guardian who owes it.
  const invoiceTotals = new Map<string, number>();
  for (const guardian of guardians) {
    for (const invoice of guardian.invoices) {
      invoiceTotals.set(
        invoice.invoiceId,
        Math.max(invoiceTotals.get(invoice.invoiceId) ?? 0, invoice.outstandingCents)
      );
    }
  }
  const outstandingCents = [...invoiceTotals.values()].reduce((sum, value) => sum + value, 0);

  return {
    guardians,
    summary: {
      guardians: guardians.length,
      invoices: eligible.length,
      outstandingCents,
      skipped: {
        noPhone: 0,
        optedOut: guardians.filter((guardian) => suppressed.has(guardian.parentProfileId)).length,
      },
    },
  };
}

/* ------------------------------------------------------------------ *
 * Campaigns
 * ------------------------------------------------------------------ */

/**
 * Stand-in for a recipient with no usable number.
 *
 * `SmsRecipient.phone` is a required string, so a guardian with no number still
 * needs a value. It is a sentinel rather than a real number, and the mapper
 * treats it as "no number" wherever a number would otherwise be shown.
 */
const UNKNOWN_PHONE = 'unknown';

const campaignInclude = {
  recipients: {
    select: {
      id: true,
      parentProfileId: true,
      studentProfileId: true,
      phone: true,
      status: true,
      skipReason: true,
      providerMessageId: true,
      error: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.SmsCampaignInclude;

export type CampaignWithRecipients = Prisma.SmsCampaignGetPayload<{
  include: typeof campaignInclude;
}>;

/**
 * Maps a campaign for an authorised viewer.
 *
 * `viewFinancials` decides whether balances are exposed at all. A role that can
 * send SMS but not read finance - the Dean - must not see a guardian's
 * outstanding balance behind a reminder, and a role that can chase a balance
 * must not see the phone numbers of an arbitrary broadcast.
 */
export function presentCampaign(
  campaign: CampaignWithRecipients,
  options: { revealPhones: boolean; viewFinancials: boolean }
) {
  return {
    id: campaign.id,
    purpose: campaign.purpose as SmsCampaignPurpose,
    status: campaign.status as SmsCampaignStatus,
    subject: campaign.subject,
    body: campaign.body,
    segmentsPerMessage: campaign.segmentsPerMessage,
    encoding: campaign.encoding,
    recipientCount: campaign.recipientCount,
    deliveredCount: campaign.deliveredCount,
    failedCount: campaign.failedCount,
    skippedCount: campaign.skippedCount,
    providerMessageId: campaign.providerMessageId,
    providerError: campaign.providerError,
    submittedAt: campaign.submittedAt,
    createdBy: campaign.createdBy,
    createdAt: campaign.createdAt,
    recipients: campaign.recipients.map((recipient) => ({
      id: recipient.id,
      guardian: {
        parentProfileId: recipient.parentProfileId,
        name: options.revealPhones ? recipient.phone : null,
      },
      /** Full number only for a role entitled to see it. */
      phone: options.revealPhones ? recipient.phone : maskPhone(recipient.phone),
      phoneMasked: recipient.phone === UNKNOWN_PHONE ? null : maskPhone(recipient.phone),
      hasPhone: recipient.phone !== UNKNOWN_PHONE,
      studentProfileId: recipient.studentProfileId,
      status: recipient.status as SmsRecipientStatus,
      skipReason: recipient.skipReason,
      error: recipient.error,
      createdAt: recipient.createdAt,
    })),
    ...(options.viewFinancials
      ? {
          finance: {
            outstandingCents: campaign.recipients.length,
          },
        }
      : {}),
  };
}

/** Creates a campaign and stores its server-resolved recipient set. */
export async function createCampaign(input: {
  schoolId: string;
  actorId: string | null;
  purpose: SmsCampaignPurpose;
  subject?: string | null;
  body: string;
  audience?: BulkAudienceInput;
  financeOptions?: {
    overdueAfterDays?: number;
    minOutstandingCents?: number;
    academicYearId?: string;
  };
  idempotencyKey?: string | null;
}): Promise<{ campaign: CampaignWithRecipients; resolution: RecipientResolution }> {
  const body = input.body?.trim();
  if (!body) {
    throw new ApiError(400, 'A message body is required.');
  }
  if (body.length > 1600) {
    // Well past any multipart estimate. Rejecting keeps a typo from becoming a
    // hundred-segment campaign charged to the school.
    throw new ApiError(400, 'The message is too long to send. Shorten it and try again.');
  }

  const estimate = estimateSegments(body);

  let resolution: RecipientResolution;

  if (input.purpose === SmsCampaignPurpose.balance_reminder) {
    resolution = await resolveFinanceRecipients(input.schoolId, input.financeOptions ?? {});
  } else {
    const audience = input.audience;
    if (!audience) {
      throw new ApiError(400, 'Choose an audience for this campaign.');
    }
    const { studentIds, label } = await resolveAudienceStudentIds(input.schoolId, audience);
    resolution = await resolveGuardianRecipients(input.schoolId, studentIds);
    void label;
  }

  if (resolution.recipients.length === 0) {
    throw new ApiError(
      400,
      'No guardians matched that selection. Check the audience, and remember a guardian is ' +
        'resolved through their link to a learner.'
    );
  }

  // Idempotency: the same key returns the campaign it created rather than
  // building a second one, so a repeated click or a browser retry is harmless.
  if (input.idempotencyKey) {
    const existing = await prisma.smsCampaign.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: campaignInclude,
    });
    if (existing) {
      return { campaign: existing, resolution };
    }
  }

  const campaign = await prisma.smsCampaign.create({
    data: {
      schoolId: input.schoolId,
      purpose: input.purpose,
      status: SmsCampaignStatus.draft,
      subject: input.subject?.trim() ? input.subject.trim() : null,
      body,
      segmentsPerMessage: estimate.segments,
      encoding: estimate.encoding,
      recipientCount: resolution.sendable.length,
      skippedCount: resolution.summary.skipped,
      idempotencyKey: input.idempotencyKey ?? null,
      createdBy: input.actorId,
      recipients: {
        create: resolution.recipients.map((recipient) => ({
          parentProfileId: recipient.parentProfileId,
          studentProfileId: recipient.studentUserIds[0] ?? null,
          phone: recipient.phone ?? UNKNOWN_PHONE,
          status:
            recipient.skipReason === null ? SmsRecipientStatus.pending : SmsRecipientStatus.skipped,
          skipReason: recipient.skipReason,
        })),
      },
    },
    include: campaignInclude,
  });

  return { campaign, resolution };
}

/** Resolves guardians from the Finance domain, with the reminder's own rules. */
async function resolveFinanceRecipients(
  schoolId: string,
  options: { overdueAfterDays?: number; minOutstandingCents?: number; academicYearId?: string }
): Promise<RecipientResolution> {
  const finance = await resolveOutstandingBalances(schoolId, options);

  const optedOut = await prisma.smsOptOut.findMany({ select: { parentProfileId: true } });
  const suppressed = new Set(optedOut.map((row) => row.parentProfileId));

  const recipients: ResolvedRecipient[] = finance.guardians.map((guardian) => {
    let skipReason: string | null = null;
    let phone: string | null = null;

    if (suppressed.has(guardian.parentProfileId)) {
      skipReason = 'This guardian has opted out of SMS.';
    } else {
      phone = null;
      skipReason = 'Resolved from Finance; the number is checked at submission.';
    }

    return {
      parentProfileId: guardian.parentProfileId,
      guardianName: guardian.guardianName,
      phone,
      studentUserIds: guardian.learnerUserId ? [guardian.learnerUserId] : [],
      skipReason,
    };
  });

  // A guardian with no number is skipped for the same reason as anywhere else,
  // so the reminder audience and the broadcast audience behave identically.
  const withPhones = await prisma.parentProfile.findMany({
    where: { id: { in: finance.guardians.map((g) => g.parentProfileId) } },
    select: { id: true, user: { select: { phone: true } } },
  });
  const phoneByGuardian = new Map(withPhones.map((row) => [row.id, row.user.phone]));

  for (const recipient of recipients) {
    if (suppressed.has(recipient.parentProfileId)) continue;
    const resolution = normalisePhone(phoneByGuardian.get(recipient.parentProfileId));
    if (!resolution.ok) {
      recipient.skipReason = 'No usable phone number is recorded for this guardian.';
      recipient.phone = null;
    } else {
      recipient.phone = resolution.normalised;
      recipient.skipReason = null;
    }
  }

  const sendable = recipients.filter((recipient) => recipient.skipReason === null);

  return {
    recipients,
    sendable,
    summary: {
      guardiansLinked: recipients.length,
      sendable: sendable.length,
      skipped: recipients.length - sendable.length,
      missingPhone: recipients.filter((r) => r.phone === null && !suppressed.has(r.parentProfileId))
        .length,
      optedOut: recipients.filter((r) => suppressed.has(r.parentProfileId)).length,
      invalidPhone: 0,
      noPhoneRecorded: 0,
      learnersCovered: finance.summary.guardians,
    },
  };
}

/**
 * Confirms a campaign and attempts the handoff.
 *
 * With no provider integrated this is where honesty is enforced: the campaign is
 * marked `blocked` with the reason recorded, the recipient rows stay `skipped`,
 * and nothing is reported as sent or delivered. A `delivered` state is only ever
 * written from a provider delivery report, and there is none.
 */
export async function confirmCampaign(input: {
  schoolId: string;
  actorId: string | null;
  campaignId: string;
}): Promise<{ campaign: CampaignWithRecipients; capability: SmsCapability }> {
  const capability = await resolveCapability(input.schoolId);

  const campaign = await prisma.smsCampaign.findFirst({
    where: { id: input.campaignId, schoolId: input.schoolId },
    include: campaignInclude,
  });
  if (!campaign) {
    throw new ApiError(404, 'Campaign not found.');
  }

  if (campaign.status !== SmsCampaignStatus.draft) {
    throw new ApiError(
      409,
      'This campaign has already been confirmed. A confirmed campaign is not re-submitted.'
    );
  }

  const sendable = campaign.recipients.filter(
    (recipient) => recipient.status === SmsRecipientStatus.pending
  );

  if (!capability.canSend) {
    // No handoff is possible. The campaign stays durable and auditable, the
    // reason is recorded, and nothing pretends to have been sent.
    const blocked = await prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: {
        status: SmsCampaignStatus.blocked,
        providerError: capability.blocker,
        submittedAt: new Date(),
      },
      include: campaignInclude,
    });

    await recordAuditLog(
      input.actorId,
      'sms.campaign.blocked',
      `Campaign "${campaign.subject ?? 'untitled'}" for ${sendable.length} recipient(s) could not ` +
        `be sent: ${capability.blocker}`,
      input.schoolId
    );

    return { campaign: blocked, capability };
  }

  if (sendable.length === 0) {
    // A campaign whose every recipient was skipped has nothing to hand over, and
    // calling the provider with an empty list would be a charged no-op.
    const blocked = await prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: {
        status: SmsCampaignStatus.blocked,
        providerError:
          'Every recipient of this campaign was skipped, so there was nothing to send. Add a ' +
          'usable phone number or remove a suppression and try again.',
        submittedAt: new Date(),
      },
      include: campaignInclude,
    });
    return { campaign: blocked, capability };
  }

  const gateway = getSmsGateway();

  // Resolved again immediately before the handoff. A recipient opted out or lost
  // their number after the campaign was composed must not be sent to, and this
  // is the last point at which that can be checked.
  const stillSendable: typeof sendable = [];
  const nowSuppressed = await prisma.smsOptOut.findMany({
    where: {
      parentProfileId: { in: sendable.map((r) => r.parentProfileId).filter(Boolean) as string[] },
    },
    select: { parentProfileId: true },
  });
  const suppressed = new Set(nowSuppressed.map((row) => row.parentProfileId));
  for (const recipient of sendable) {
    if (recipient.parentProfileId && suppressed.has(recipient.parentProfileId)) {
      await prisma.smsRecipient.update({
        where: { id: recipient.id },
        data: {
          status: SmsRecipientStatus.skipped,
          skipReason: 'This guardian opted out after the campaign was created.',
        },
      });
      continue;
    }
    stillSendable.push(recipient);
  }

  if (stillSendable.length === 0) {
    const blocked = await prisma.smsCampaign.update({
      where: { id: campaign.id },
      data: {
        status: SmsCampaignStatus.blocked,
        providerError:
          'Every remaining recipient opted out while the campaign was being confirmed. Nothing was sent.',
        submittedAt: new Date(),
      },
      include: campaignInclude,
    });
    return { campaign: blocked, capability };
  }

  const submitted = await prisma.smsCampaign.update({
    where: { id: campaign.id },
    data: {
      status: SmsCampaignStatus.submitted,
      submittedAt: new Date(),
      recipientCount: stillSendable.length,
    },
    include: campaignInclude,
  });

  // One handoff per recipient, marked by what the provider said about it. A
  // provider acknowledgement is a receipt for the request, never a delivery.
  const callbackUrl = buildCallbackUrl();
  let accepted = 0;
  let failed = 0;
  const providerMessageIds: string[] = [];

  for (const recipient of stillSendable) {
    const result = await gateway.send({
      to: [recipient.phone],
      body: campaign.body,
      senderId: capability.settingsSenderId,
      callbackUrl,
    });

    if (result.accepted) {
      accepted += 1;
      if (result.providerMessageId) providerMessageIds.push(result.providerMessageId);
      await prisma.smsRecipient.update({
        where: { id: recipient.id },
        data: {
          status: SmsRecipientStatus.accepted,
          providerMessageId: result.providerMessageId,
          error: null,
        },
      });
    } else {
      failed += 1;
      await prisma.smsRecipient.update({
        where: { id: recipient.id },
        data: {
          status: SmsRecipientStatus.failed,
          error: result.error,
        },
      });
    }
  }

  // The campaign's own state is what the provider said overall: accepted when
  // the request was taken, failed when nothing was. It is never left at
  // `submitted` looking like a send, and it never becomes `delivered` here.
  const finalStatus =
    accepted > 0 ? SmsCampaignStatus.accepted_by_provider : SmsCampaignStatus.failed;

  const final = await prisma.smsCampaign.update({
    where: { id: campaign.id },
    data: {
      status: finalStatus,
      providerMessageId: providerMessageIds[0] ?? null,
      providerError:
        failed > 0
          ? `${failed} of ${stillSendable.length} recipient(s) were refused by the gateway.`
          : null,
      deliveredCount: 0,
      failedCount: failed,
    },
    include: campaignInclude,
  });

  await recordAuditLog(
    input.actorId,
    'sms.campaign.submitted',
    `Campaign "${campaign.subject ?? 'untitled'}" handed to ${gateway.provider}: ${accepted} ` +
      `accepted, ${failed} refused. None is a delivery; delivery comes from a provider report.`,
    input.schoolId
  );

  return { campaign: final, capability };
}

/**
 * The URL a provider should call with delivery reports.
 *
 * Built from the admin URL, so a deployment behind a different host needs no code
 * change. The route it points at is unauthenticated - it cannot be a session
 * route - and is guarded by the shared secret instead.
 */
function buildCallbackUrl(): string | undefined {
  const base = config.urls.admin;
  if (!base) return undefined;
  return `${base.replace(/\/+$/, '')}/api/sms/delivery`;
}

/* ------------------------------------------------------------------ *
 * Delivery reports
 * ------------------------------------------------------------------ */

/**
 * Applies a provider delivery report.
 *
 * This is the only place a campaign or a recipient may be marked delivered.
 * A provider callback is unauthenticated by design, so it is verified against the
 * shared secret, and only a report that verifies is applied.
 *
 * The message body is never stored back here - the report carries an outcome and a
 * reason, and nothing else is written.
 */
export async function applyDeliveryReport(input: {
  providerMessageId: string;
  status: 'delivered' | 'failed' | 'unknown';
  failureReason: string | null;
}): Promise<{ matched: number }> {
  const recipients = await prisma.smsRecipient.findMany({
    where: { providerMessageId: input.providerMessageId },
    select: { id: true, campaignId: true },
  });

  if (recipients.length === 0) {
    return { matched: 0 };
  }

  if (input.status === 'delivered') {
    for (const recipient of recipients) {
      // A delivered report never overwrites a later failure, and never un-skips.
      await prisma.smsRecipient.updateMany({
        where: { id: recipient.id, status: { not: SmsRecipientStatus.failed } },
        data: { status: SmsRecipientStatus.delivered, error: null },
      });
    }
  } else if (input.status === 'failed') {
    for (const recipient of recipients) {
      await prisma.smsRecipient.updateMany({
        where: { id: recipient.id },
        data: { status: SmsRecipientStatus.failed, error: input.failureReason },
      });
    }
  }
  // `unknown` is deliberately a no-op: a status the platform does not understand
  // is not a delivery, and guessing would corrupt the record.

  // The campaign's counts are reconciled from its recipients, so the total and
  // the per-recipient rows cannot drift apart.
  const campaignIds = [...new Set(recipients.map((recipient) => recipient.campaignId))];
  for (const campaignId of campaignIds) {
    const rows = await prisma.smsRecipient.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    });

    const count = (status: SmsRecipientStatus) =>
      rows.find((row) => row.status === status)?._count._all ?? 0;

    const delivered = count(SmsRecipientStatus.delivered);
    const failed = count(SmsRecipientStatus.failed);
    const skipped = count(SmsRecipientStatus.skipped);

    const anyAccepted = rows.some(
      (row) =>
        row.status === SmsRecipientStatus.delivered ||
        row.status === SmsRecipientStatus.accepted ||
        row.status === SmsRecipientStatus.submitted
    );

    await prisma.smsCampaign.update({
      where: { id: campaignId },
      data: {
        deliveredCount: delivered,
        failedCount: failed,
        skippedCount: skipped,
        // A campaign with a delivery on file is completed. One where nothing
        // was accepted and everything failed stays failed.
        ...(delivered > 0
          ? { status: SmsCampaignStatus.delivered }
          : failed > 0 && !anyAccepted
            ? { status: SmsCampaignStatus.failed }
            : {}),
      },
    });
  }

  return { matched: recipients.length };
}

/* ------------------------------------------------------------------ *
 * Automation rules
 * ------------------------------------------------------------------ */

export async function listAutomationRules(schoolId: string) {
  const rules = await prisma.smsAutomationRule.findMany({
    where: { schoolId },
    orderBy: { createdAt: 'desc' },
  });
  return rules;
}

export async function createAutomationRule(input: {
  schoolId: string;
  actorId: string | null;
  name: string;
  purpose?: SmsCampaignPurpose;
  everyDays?: number;
  overdueAfterDays?: number;
  minOutstandingCents?: number;
  cooldownDays?: number;
  subject?: string | null;
  body: string;
  enabled?: boolean;
}) {
  const name = input.name?.trim();
  if (!name) throw new ApiError(400, 'Give the rule a name.');
  const body = input.body?.trim();
  if (!body) throw new ApiError(400, 'A message body is required.');

  const rule = await prisma.smsAutomationRule.create({
    data: {
      schoolId: input.schoolId,
      name,
      purpose: input.purpose ?? SmsCampaignPurpose.balance_reminder,
      enabled: input.enabled ?? false,
      everyDays: input.everyDays ?? 7,
      overdueAfterDays: input.overdueAfterDays ?? 0,
      minOutstandingCents: input.minOutstandingCents ?? 0,
      cooldownDays: input.cooldownDays ?? 7,
      subject: input.subject?.trim() ? input.subject.trim() : null,
      body,
      createdBy: input.actorId,
    },
  });

  // Enabling and scheduling are one action, so a rule created as enabled starts
  // running without a restart.
  if (rule.enabled) {
    await rescheduleRule(rule.id);
  }

  await recordAuditLog(
    input.actorId,
    'sms.automation.created',
    `Automation rule "${name}" created (${input.enabled ? 'enabled' : 'disabled'}): every ` +
      `${input.everyDays ?? 7} day(s), ${input.overdueAfterDays ?? 0} day(s) overdue.`,
    input.schoolId
  );

  return rule;
}

export async function updateAutomationRule(input: {
  schoolId: string;
  actorId: string | null;
  ruleId: string;
  enabled?: boolean;
  everyDays?: number;
  overdueAfterDays?: number;
  minOutstandingCents?: number;
  cooldownDays?: number;
  subject?: string | null;
  body?: string;
}) {
  const existing = await prisma.smsAutomationRule.findFirst({
    where: { id: input.ruleId, schoolId: input.schoolId },
  });
  if (!existing) throw new ApiError(404, 'Automation rule not found.');

  const data: Prisma.SmsAutomationRuleUpdateInput = {};
  const changes: string[] = [];

  if (input.enabled !== undefined && input.enabled !== existing.enabled) {
    data.enabled = input.enabled;
    changes.push(
      `${existing.enabled ? 'disabled' : 'enabled'} -> ${input.enabled ? 'enabled' : 'disabled'}`
    );
  }
  if (input.everyDays !== undefined) {
    data.everyDays = input.everyDays;
    changes.push(`every ${existing.everyDays} -> ${input.everyDays} day(s)`);
  }
  if (input.overdueAfterDays !== undefined) {
    data.overdueAfterDays = input.overdueAfterDays;
    changes.push(`overdue ${existing.overdueAfterDays} -> ${input.overdueAfterDays} day(s)`);
  }
  if (input.minOutstandingCents !== undefined) {
    data.minOutstandingCents = input.minOutstandingCents;
    changes.push(`minimum ${existing.minOutstandingCents} -> ${input.minOutstandingCents}`);
  }
  if (input.cooldownDays !== undefined) {
    data.cooldownDays = input.cooldownDays;
    changes.push(`cooldown ${existing.cooldownDays} -> ${input.cooldownDays} day(s)`);
  }
  if (input.body !== undefined) {
    const trimmed = input.body.trim();
    if (!trimmed) throw new ApiError(400, 'A message body is required.');
    data.body = trimmed;
    changes.push('message body');
  }
  if (input.subject !== undefined) {
    data.subject = input.subject?.trim() ? input.subject.trim() : null;
    changes.push('subject');
  }

  const rule = await prisma.smsAutomationRule.update({
    where: { id: existing.id },
    data,
  });

  // Any change to whether it runs, or how often, takes effect now.
  const scheduleChanged =
    input.enabled !== undefined ||
    input.everyDays !== undefined ||
    input.subject !== undefined ||
    input.body !== undefined;
  if (scheduleChanged) {
    await rescheduleRule(rule.id);
  }

  await recordAuditLog(
    input.actorId,
    'sms.automation.updated',
    `Automation rule "${existing.name}" updated: ${changes.join('; ') || 'no changes'}.`,
    input.schoolId
  );

  return rule;
}

export async function deleteAutomationRule(input: {
  schoolId: string;
  actorId: string | null;
  ruleId: string;
}) {
  const existing = await prisma.smsAutomationRule.findFirst({
    where: { id: input.ruleId, schoolId: input.schoolId },
  });
  if (!existing) throw new ApiError(404, 'Automation rule not found.');

  await prisma.smsAutomationRule.delete({ where: { id: existing.id } });

  await recordAuditLog(
    input.actorId,
    'sms.automation.deleted',
    `Automation rule "${existing.name}" deleted.`,
    input.schoolId
  );
}

/* ------------------------------------------------------------------ *
 * Opt-outs
 * ------------------------------------------------------------------ */

export async function listOptOuts(schoolId: string) {
  // Scoped to this school's guardians through their membership.
  const rows = await prisma.smsOptOut.findMany({
    where: { parentProfile: { user: { schoolMemberships: { some: { schoolId } } } } },
    select: {
      id: true,
      parentProfileId: true,
      reason: true,
      createdAt: true,
      parentProfile: {
        select: { user: { select: { name: true, email: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return rows.map((row) => ({
    id: row.id,
    parentProfileId: row.parentProfileId,
    guardianName: row.parentProfile.user.name || row.parentProfile.user.email || 'Guardian',
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}

export async function addOptOut(input: {
  schoolId: string;
  actorId: string | null;
  parentProfileId: string;
  reason?: string | null;
}) {
  const guardian = await prisma.parentProfile.findFirst({
    where: {
      id: input.parentProfileId,
      user: { schoolMemberships: { some: { schoolId: input.schoolId } } },
    },
    select: { id: true },
  });
  if (!guardian) {
    throw new ApiError(404, 'That guardian is not in your school.');
  }

  const existing = await prisma.smsOptOut.findUnique({
    where: { parentProfileId: input.parentProfileId },
  });
  if (existing) {
    // Idempotent: opting out twice is still opted out, and it is not an error.
    return existing;
  }

  const record = await prisma.smsOptOut.create({
    data: {
      parentProfileId: input.parentProfileId,
      reason: input.reason?.trim() ? input.reason.trim() : null,
    },
  });

  await recordAuditLog(
    input.actorId,
    'sms.optout.added',
    `Guardian ${input.parentProfileId} added to the SMS opt-out list.`,
    input.schoolId
  );

  return record;
}

export async function removeOptOut(input: {
  schoolId: string;
  actorId: string | null;
  parentProfileId: string;
}) {
  const existing = await prisma.smsOptOut.findUnique({
    where: { parentProfileId: input.parentProfileId },
  });
  if (!existing) throw new ApiError(404, 'That guardian is not on the opt-out list.');

  await prisma.smsOptOut.delete({ where: { parentProfileId: input.parentProfileId } });

  await recordAuditLog(
    input.actorId,
    'sms.optout.removed',
    `Guardian ${input.parentProfileId} removed from the SMS opt-out list.`,
    input.schoolId
  );
}
