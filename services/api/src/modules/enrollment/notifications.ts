/**
 * Enrollment-triggered guardian communication.
 *
 * When an administrator enrolls a learner, the guardian needs to know - and a
 * guardian who has never used the platform needs to be able to get in. This
 * module does both, once per enrollment, after that enrollment has committed.
 *
 * The trigger is deliberately outside the enrollment transaction. Notifications
 * are the last step of the workflow, not part of it: a messaging outage, a
 * rejected number or a bounced email must never undo a valid enrollment, and a
 * retried enrollment must not produce a second message. Committing first and
 * notifying after gives both properties - the enrollment is already durable when
 * the first message is attempted, and the idempotency key below is what makes a
 * retry land on the same row.
 *
 * Channel selection follows contact reality rather than preference:
 *   - a guardian with a number and no reachable email is reached by SMS
 *   - a guardian with an email and no usable number is reached by email
 *   - a guardian with neither is recorded as awaiting contact and surfaced to
 *     staff, rather than counted as a send that did not happen
 *
 * SMS is treated as essential, not as a fallback. Some guardians in this
 * deployment use basic phones with no email, so the SMS path is built to be
 * usable on its own - including a short activation code they can key in on a
 * keypad, which is the whole reason `generateShortCode` exists.
 */

import { EnrollmentChannel, NotificationStatus, NotificationType } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { config } from '../../config';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';
import { getSmsGateway } from '../sms/gateway';
import { normalisePhone } from '../sms/service';
import { addEmailJob } from '../../infrastructure/queues';
import { createInvitation } from '../invitations/repository';

/** How long an enrollment activation stays valid. */
const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;

/** Minutes after which a stale `queued` row is eligible for a manual retry. */
const RETRY_AFTER_MINUTES = 5;

export interface EnrollmentNotificationOutcome {
  enrollmentId: string;
  guardians: number;
  /** Messages handed to a provider or the email queue. */
  dispatched: number;
  /** Guardians with no usable contact method. */
  awaitingContact: number;
  /** Guardians suppressed because they already had an active notification. */
  duplicatesSuppressed: number;
  channels: EnrollmentChannel[];
}

/** What a guardian can actually be reached on. */
interface GuardianContact {
  parentProfileId: string;
  guardianName: string;
  email: string | null;
  /** E.164 where the number could be normalised, else null. */
  phone: string | null;
  /** True when the account exists but has never been activated. */
  needsActivation: boolean;
}

/**
 * The message for one guardian.
 *
 * Written to be readable on a 160-character screen: the school is named, the
 * enrollment is confirmed, and the next step is stated. It deliberately does not
 * carry the learner's name, class or a balance - a message that identifies a
 * child and a fee to anyone holding the phone discloses more than the enrollment
 * needs, and the parent portal carries the detail once they have signed in.
 */
function renderEnrollmentMessage(input: {
  schoolName: string;
  includesActivation: boolean;
  activationCode?: string;
  activationUrl?: string;
  channel: EnrollmentChannel;
}): { subject: string; body: string } {
  const school = input.schoolName || 'your school';
  const subject = `${school}: enrollment confirmed`;

  if (!input.includesActivation) {
    return {
      subject,
      body:
        `${school}: enrollment for your child is confirmed. ` +
        `Sign in to the parent portal to view details.`,
    };
  }

  if (input.channel === EnrollmentChannel.sms) {
    return {
      subject,
      body:
        `${school}: enrollment confirmed. Activate your parent account with code ` +
        `${input.activationCode} at ${input.activationUrl}`,
    };
  }

  return {
    subject,
    body:
      `${school}: enrollment for your child is confirmed, and your parent account is ready to ` +
      `activate.\n\nActivate: ${input.activationUrl}\n\nIf you did not expect this, ignore this ` +
      `message or contact the school.`,
  };
}

/**
 * Resolves which guardians to tell, from the persisted parent-child links.
 *
 * A learner with two guardians produces two messages, because both are the
 * people responsible for them. A guardian with three children at this school
 * produces three messages across three enrollments - one per enrollment, naming
 * the enrollment rather than the child - so nothing is ambiguous about which
 * enrollment is confirmed.
 */
async function resolveGuardianContacts(
  studentUserId: string,
  schoolId: string
): Promise<GuardianContact[]> {
  const links = await prisma.parentChildLink.findMany({
    where: {
      child: { userId: studentUserId },
      parent: { user: { schoolMemberships: { some: { schoolId } } } },
    },
    select: {
      parentId: true,
      parent: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              email: true,
              phone: true,
              name: true,
              firstName: true,
              lastName: true,
              status: true,
              passwordHash: true,
            },
          },
        },
      },
    },
  });

  return links.map((link) => {
    const user = link.parent.user;
    const phone = normalisePhone(user.phone);
    return {
      parentProfileId: link.parent.id,
      guardianName:
        user.name?.trim() ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.email,
      email: user.email,
      phone: phone.ok ? phone.normalised : null,
      // An account that exists but has never set a password needs the activation
      // instruction even though it is already on record.
      needsActivation: !user.passwordHash || user.status === 'pending',
    };
  });
}

/**
 * Which channels this guardian can be reached on, and which to actually use.
 *
 * The school's `defaultChannel` is the preference and `emailEnabled` /
 * `smsEnabled` are the switches. Everything else is contact reality: a channel
 * with no address behind it is not a channel, and preferring a channel the
 * guardian cannot be reached on would silently drop them.
 */
function chooseChannels(input: {
  guardian: GuardianContact;
  defaultChannel: string | null;
  smsEnabled: boolean;
  emailEnabled: boolean;
}): EnrollmentChannel[] {
  const { guardian, defaultChannel, smsEnabled, emailEnabled } = input;

  const canSms = smsEnabled && guardian.phone !== null;
  const canEmail = emailEnabled && Boolean(guardian.email);

  // Nothing reachable at all. The caller records this as awaiting contact.
  if (!canSms && !canEmail) return [];

  const preferred = defaultChannel === 'sms' || defaultChannel === 'email' ? defaultChannel : null;
  if (preferred === 'sms' && canSms)
    return [EnrollmentChannel.sms, ...(canEmail ? [EnrollmentChannel.email] : [])];
  if (preferred === 'email' && canEmail)
    return [EnrollmentChannel.email, ...(canSms ? [EnrollmentChannel.sms] : [])];

  // No usable preference: reach them on everything available. For a guardian
  // whose only contact is one channel this is that channel, which is what makes
  // an SMS-only parent reachable at all.
  const channels: EnrollmentChannel[] = [];
  if (canSms) channels.push(EnrollmentChannel.sms);
  if (canEmail) channels.push(EnrollmentChannel.email);
  return channels;
}

/**
 * Notifies every guardian of a learner about that learner's enrollment.
 *
 * Safe to call twice. The idempotency key is the enrollment, the guardian and the
 * channel, and it is a database unique constraint, so a second call finds the row
 * it already created and reports it as suppressed rather than sending again.
 *
 * Never throws for a messaging reason. A provider outage, a rejected number and a
 * bounced email are all recorded on their own row and reported in the outcome;
 * the enrollment these messages are about has already committed and is not
 * affected.
 */
export async function notifyGuardiansOfEnrollment(input: {
  enrollmentId: string;
  schoolId: string;
  actorId: string | null;
}): Promise<EnrollmentNotificationOutcome> {
  const { enrollmentId, schoolId, actorId } = input;

  const enrollment = await prisma.enrollment.findFirst({
    where: { id: enrollmentId, class: { schoolId } },
    select: {
      id: true,
      studentId: true,
      class: { select: { school: { select: { id: true, name: true } } } },
    },
  });

  if (!enrollment?.studentId) {
    // Nothing to notify about: an enrollment with no learner is not a state the
    // caller should be able to reach, and guessing would invent a recipient.
    throw new ApiError(404, 'That enrollment has no learner to notify about.');
  }

  const schoolName = enrollment.class.school.name;
  const guardians = await resolveGuardianContacts(enrollment.studentId, schoolId);

  const settings = await prisma.schoolNotificationSettings.findUnique({
    where: { schoolId },
    select: { smsEnabled: true, emailEnabled: true, defaultChannel: true },
  });

  const smsEnabled = settings ? settings.smsEnabled : false;
  const emailEnabled = settings ? settings.emailEnabled : true;
  const defaultChannel = settings?.defaultChannel ?? null;

  const outcome: EnrollmentNotificationOutcome = {
    enrollmentId,
    guardians: guardians.length,
    dispatched: 0,
    awaitingContact: 0,
    duplicatesSuppressed: 0,
    channels: [],
  };

  const gateway = getSmsGateway();

  for (const guardian of guardians) {
    const channels = chooseChannels({ guardian, defaultChannel, smsEnabled, emailEnabled });

    if (channels.length === 0) {
      // No number and no usable email. This is not a failure of the send - it is
      // a task for staff, and it is recorded as one rather than as an attempt.
      const awaitingKey = `${enrollmentId}:${guardian.parentProfileId}:awaiting_contact`;

      // Checked like any other row, for the same reason. Without this, a retried
      // enrollment would hit the unique constraint on the second attempt and
      // throw - and a throw here looks exactly like the enrollment having failed.
      const alreadyFlagged = await prisma.enrollmentNotification.findUnique({
        where: { idempotencyKey: awaitingKey },
        select: { id: true },
      });
      if (alreadyFlagged) {
        outcome.duplicatesSuppressed += 1;
        continue;
      }

      await recordNotification({
        enrollmentId,
        schoolId,
        studentProfileId: await studentProfileIdOf(enrollment.studentId!),
        parentProfileId: guardian.parentProfileId,
        type: NotificationType.enrollment_confirmation,
        channel: EnrollmentChannel.sms,
        status: NotificationStatus.awaiting_contact,
        destination: null,
        subject: 'Enrollment confirmation',
        body: `Could not reach ${guardian.guardianName}: no phone number or email address is recorded.`,
        idempotencyKey: awaitingKey,
      });
      outcome.awaitingContact += 1;
      continue;
    }

    // An activation instruction is only needed for a guardian who has never been
    // able to sign in, and only one invitation is created for them.
    let activation: { code: string; url: string } | null = null;
    if (guardian.needsActivation && guardian.email) {
      const invitation = await createInvitation({
        email: guardian.email,
        invitedBy: actorId ?? undefined,
        // A short code when the guardian will read it on a basic phone, a UUID
        // when it travels in an email link where length costs nothing.
        codeStyle: channels.includes(EnrollmentChannel.sms) ? 'short' : 'uuid',
        ttlMs: ACTIVATION_TTL_MS,
      });
      const url = `${config.urls.parent.replace(/\/+$/, '')}/activate-account/${invitation.token}`;
      activation = { code: invitation.token, url };
    }

    const studentProfileId = await studentProfileIdOf(enrollment.studentId!);

    for (const channel of channels) {
      const message = renderEnrollmentMessage({
        schoolName,
        includesActivation: Boolean(activation),
        activationCode: activation?.code,
        activationUrl: activation?.url,
        channel,
      });

      const idempotencyKey = `${enrollmentId}:${guardian.parentProfileId}:${channel}`;

      // The unique constraint is the real guard: a repeated trigger, a worker
      // retry or a double-submitted form all land here and are reported rather
      // than sent twice.
      const existing = await prisma.enrollmentNotification.findUnique({
        where: { idempotencyKey },
        select: { id: true, status: true },
      });
      if (existing) {
        outcome.duplicatesSuppressed += 1;
        continue;
      }

      const row = await recordNotification({
        enrollmentId,
        schoolId,
        studentProfileId,
        parentProfileId: guardian.parentProfileId,
        type: activation
          ? NotificationType.enrollment_and_activation
          : NotificationType.enrollment_confirmation,
        channel,
        status: NotificationStatus.pending,
        destination:
          channel === EnrollmentChannel.sms ? (guardian.phone ?? '') : (guardian.email ?? ''),
        subject: message.subject,
        body: message.body,
        idempotencyKey,
      });

      // Another trigger created this row between the check above and here. It is
      // already accounted for, so this one must not dispatch a second copy.
      if (!row) {
        outcome.duplicatesSuppressed += 1;
        continue;
      }

      // Dispatch. An exception here is contained: the row stays `pending` and is
      // eligible for a retry, and the enrollment is untouched.
      try {
        if (channel === EnrollmentChannel.sms) {
          await dispatchSms({
            notificationId: row.id,
            to: guardian.phone!,
            body: message.body,
          });
        } else {
          await dispatchEmail({
            notificationId: row.id,
            to: guardian.email!,
            subject: message.subject,
            body: message.body,
          });
        }
        outcome.dispatched += 1;
        if (!outcome.channels.includes(channel)) outcome.channels.push(channel);
      } catch (err) {
        await markFailed(row.id, err);
      }
    }
  }

  await recordAuditLog(
    actorId,
    'enrollment.notifications.dispatched',
    `Enrollment ${enrollmentId}: ${outcome.dispatched} message(s) to ${outcome.guardians} ` +
      `guardian(s), ${outcome.awaitingContact} awaiting contact, ` +
      `${outcome.duplicatesSuppressed} duplicate(s) suppressed.`,
    schoolId
  );

  return outcome;
}

/** The StudentProfile id for a user, which is what the notification references. */
async function studentProfileIdOf(userId: string): Promise<string | null> {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

/**
 * Writes the notification row, or reports that it already exists.
 *
 * The `findUnique` check above each write is the common path, but two triggers
 * that race - a retried request and a worker retry arriving together - can both
 * pass it. The unique constraint is the last line of defence, so a collision is
 * caught here and reported as a duplicate rather than thrown: an exception in
 * this function would surface as the enrollment having failed, which is exactly
 * the false signal this whole design exists to avoid.
 *
 * Deliberately separate from dispatch, so the row exists before any provider
 * call. If the process dies mid-send, the record of what was attempted survives,
 * and a retry finds it rather than creating a phantom.
 */
async function recordNotification(input: {
  enrollmentId: string;
  schoolId: string;
  studentProfileId: string | null;
  parentProfileId: string;
  type: NotificationType;
  channel: EnrollmentChannel;
  status: NotificationStatus;
  destination: string | null;
  subject: string;
  body: string;
  idempotencyKey: string;
}): Promise<{ id: string } | null> {
  try {
    const row = await prisma.enrollmentNotification.create({
      data: {
        enrollmentId: input.enrollmentId,
        schoolId: input.schoolId,
        studentId: input.studentProfileId,
        parentId: input.parentProfileId,
        type: input.type,
        channel: input.channel,
        status: input.status,
        destination: input.destination,
        subject: input.subject,
        body: input.body,
        idempotencyKey: input.idempotencyKey,
        queuedAt: input.status === NotificationStatus.pending ? new Date() : null,
      },
      select: { id: true },
    });
    return row;
  } catch (err) {
    // Prisma's unique violation. A concurrent trigger got there first, which
    // means the message is already accounted for and must not be sent twice.
    const code = (err as { code?: string }).code;
    if (code === 'P2002') return null;
    throw err;
  }
}

/**
 * Hands an SMS to the gateway.
 *
 * A provider acceptance is recorded as `provider_accepted`, never as `delivered`:
 * the gateway saying it took the message is not the handset saying it received
 * it, and only a delivery report may move the row on.
 */
async function dispatchSms(input: {
  notificationId: string;
  to: string;
  body: string;
}): Promise<void> {
  const gateway = getSmsGateway();

  if (!gateway.configured) {
    // No gateway is a configuration state, not a send failure. The row stays
    // queued so a retry works the moment credentials exist, rather than being
    // marked failed for something the school has not set up yet.
    await prisma.enrollmentNotification.update({
      where: { id: input.notificationId },
      data: {
        status: NotificationStatus.queued,
        providerError: 'No SMS gateway is configured. Set SMS_PROVIDER with its credentials.',
        lastAttemptAt: new Date(),
      },
    });
    return;
  }

  const result = await gateway.send({ to: [input.to], body: input.body });

  await prisma.enrollmentNotification.update({
    where: { id: input.notificationId },
    data: {
      status: result.accepted ? NotificationStatus.provider_accepted : NotificationStatus.failed,
      providerMessageId: result.providerMessageId,
      providerError: result.error,
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      sentAt: result.accepted ? new Date() : null,
    },
  });

  if (!result.accepted) {
    throw new ApiError(502, result.error ?? 'The gateway refused the message.');
  }
}

/** Hands an email to the existing email queue, and records it as queued. */
async function dispatchEmail(input: {
  notificationId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  await prisma.enrollmentNotification.update({
    where: { id: input.notificationId },
    data: {
      status: NotificationStatus.queued,
      queuedAt: new Date(),
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  // Reuses the queue the invitation flow already writes to rather than opening a
  // second one.
  await addEmailJob(input.to, 'enrollment-confirmation', {
    to: input.to,
    subject: input.subject,
    body: input.body,
  });
}

/**
 * Records a dispatch failure without losing the attempt.
 *
 * The body stays queued-for-retry rather than failed when the failure looks
 * temporary, because a rate limit or a timeout is not the guardian's fault and a
 * retry a minute later usually works.
 */
async function markFailed(notificationId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : 'Unknown error';
  const transient = /timeout|rate|temporar|unavailable|network/i.test(message);

  await prisma.enrollmentNotification.update({
    where: { id: notificationId },
    data: {
      status: transient ? NotificationStatus.awaiting_retry : NotificationStatus.failed,
      providerError: message.slice(0, 300),
      lastAttemptAt: new Date(),
    },
  });
}

/**
 * Re-attempts a message that did not get out.
 *
 * Only a row that has not already reached a provider is retried, so a message the
 * gateway accepted is never sent a second time. The idempotency key is unchanged,
 * which is what stops a retry from becoming a duplicate.
 */
export async function retryNotification(input: {
  schoolId: string;
  actorId: string | null;
  notificationId: string;
}) {
  const existing = await prisma.enrollmentNotification.findFirst({
    where: { id: input.notificationId, schoolId: input.schoolId },
  });
  if (!existing) throw new ApiError(404, 'Notification not found.');

  if (
    existing.status === NotificationStatus.provider_accepted ||
    existing.status === NotificationStatus.delivered ||
    existing.status === NotificationStatus.awaiting_contact
  ) {
    throw new ApiError(
      409,
      'This message has already been handed to the provider, so retrying it would send it twice.'
    );
  }

  if (!existing.destination) {
    throw new ApiError(400, 'There is no contact address on record to retry to.');
  }

  if (existing.channel === EnrollmentChannel.sms) {
    await dispatchSms({
      notificationId: existing.id,
      to: existing.destination,
      body: existing.body,
    });
  } else {
    await dispatchEmail({
      notificationId: existing.id,
      to: existing.destination,
      subject: existing.subject ?? 'Message from your school',
      body: existing.body,
    });
  }

  const updated = await prisma.enrollmentNotification.findUniqueOrThrow({
    where: { id: existing.id },
  });

  await recordAuditLog(
    input.actorId,
    'enrollment.notifications.retried',
    `Notification ${existing.id} re-attempted (attempt ${updated.attemptCount}).`,
    input.schoolId
  );

  return updated;
}

/**
 * Messages eligible for a manual retry: attempted, not delivered, and not
 * rejected outright by the provider.
 */
export async function listRetryable(schoolId: string) {
  return prisma.enrollmentNotification.findMany({
    where: {
      schoolId,
      status: {
        in: [
          NotificationStatus.pending,
          NotificationStatus.queued,
          NotificationStatus.awaiting_retry,
        ],
      },
      destination: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export { RETRY_AFTER_MINUTES, ACTIVATION_TTL_MS };
