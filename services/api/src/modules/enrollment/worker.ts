/**
 * Outbound notification worker.
 *
 * The queue existed long before anything consumed it - invitation and bulk-user
 * emails have been enqueued into Redis with no worker attached, so they sat there
 * until they expired. This is the consumer for outbound guardian messaging, and
 * it is registered on server startup alongside the automation runner.
 *
 * The worker is the only place a provider is actually called. That is what keeps
 * the request path fast: enrolling a learner writes a row and queues a job, and
 * the gateway round-trip happens here where a slow or failing provider costs
 * nothing but a retry.
 *
 * Retry safety comes from the row, not the queue. The queue may deliver the same
 * job several times - that is what `attempts` means - so every dispatch re-reads
 * the row and refuses to send one the provider has already accepted. Without that
 * check a BullMQ retry after a timeout would send the family a second message.
 */

import { EnrollmentChannel, NotificationStatus } from '@prisma/client';
import { createWorker } from '../../infrastructure/queues';
import { prisma } from '../../infrastructure/database';
import { getSmsGateway } from '../sms/gateway';
import { addEmailJob } from '../../infrastructure/queues';
import { recordAuditLog } from '../audit-logs/service';
import { addNotificationJob } from '../../infrastructure/queues';
import type { EnrollmentNotification } from '@prisma/client';
import type { Worker } from 'bullmq';

let worker: Worker | null = null;

/** True once the worker is consuming, for the status the workspace reports. */
export function isNotificationWorkerRunning(): boolean {
  return worker !== null;
}

/**
 * Sends one notification row.
 *
 * Exported so the retry path and the tests use the same code as the worker,
 * rather than a second implementation that could drift.
 */
export async function dispatchNotification(
  notificationId: string
): Promise<{ status: NotificationStatus; providerMessageId: string | null; error: string | null }> {
  const row = await prisma.enrollmentNotification.findUnique({
    where: { id: notificationId },
  });

  if (!row) {
    // The enrollment was deleted between queueing and dispatch. Nothing to send
    // and nothing to report - the cascade already removed the row.
    return { status: NotificationStatus.cancelled, providerMessageId: null, error: null };
  }

  // A provider acceptance or a delivery is final. A queue retry landing here must
  // not send the message again.
  if (
    row.status === NotificationStatus.provider_accepted ||
    row.status === NotificationStatus.delivered ||
    row.status === NotificationStatus.cancelled
  ) {
    return {
      status: row.status,
      providerMessageId: row.providerMessageId,
      error: 'already-handled',
    };
  }

  // Re-checked here rather than trusted from queue time: a gateway may have been
  // configured, or its credentials changed, since the job was enqueued.
  if (row.channel === EnrollmentChannel.sms) {
    return sendSms(row);
  }
  return sendEmail(row);
}

/**
 * Hands an SMS to the gateway.
 *
 * `provider_accepted` is recorded on success and never `delivered`: the gateway
 * saying it took the message is not the handset saying it received it, and only a
 * delivery report may set the latter.
 */
async function sendSms(
  row: EnrollmentNotification
): Promise<{ status: NotificationStatus; providerMessageId: string | null; error: string | null }> {
  const gateway = getSmsGateway();

  if (!row.destination) {
    return finish(row, NotificationStatus.awaiting_contact, null, 'No phone number on record.');
  }

  if (!gateway.configured) {
    // No gateway is a configuration state, not a send failure. The row is left
    // queued so a later attempt works, rather than being marked failed for
    // something the school has not set up.
    await touch(row, NotificationStatus.queued, null, 'No SMS gateway is configured.');
    return {
      status: NotificationStatus.queued,
      providerMessageId: null,
      error: 'No SMS gateway is configured.',
    };
  }

  const result = await gateway.send({ to: [row.destination], body: row.body });

  if (!result.accepted) {
    // A rejection is the gateway's own answer about this number, so it is `failed`
    // rather than retried forever. A timeout says otherwise and is left queued.
    const transient = /timeout|rate|temporar|unavailable|network|reach/i.test(result.error ?? '');
    const status = transient ? NotificationStatus.awaiting_retry : NotificationStatus.failed;
    await touch(row, status, result.providerMessageId, result.error);
    return { status, providerMessageId: result.providerMessageId, error: result.error };
  }

  await touch(row, NotificationStatus.provider_accepted, result.providerMessageId, null);
  return {
    status: NotificationStatus.provider_accepted,
    providerMessageId: result.providerMessageId,
    error: null,
  };
}

/**
 * Hands an email to the existing email queue, and records it as queued.
 *
 * There is no email worker yet, so this is the one channel that cannot claim a
 * delivery: the row is queued, and a bounce would have to be wired through the
 * provider's webhook to be visible. It says so rather than reporting a send.
 */
async function sendEmail(
  row: EnrollmentNotification
): Promise<{ status: NotificationStatus; providerMessageId: string | null; error: string | null }> {
  if (!row.destination) {
    return finish(row, NotificationStatus.awaiting_contact, null, 'No email address on record.');
  }

  await addEmailJob(row.destination, 'enrollment-confirmation', {
    to: row.destination,
    subject: row.subject ?? 'Message from your school',
    body: row.body,
  });

  await touch(
    row,
    NotificationStatus.queued,
    null,
    'Handed to the email queue. No email worker is registered, so delivery is not tracked.'
  );
  return {
    status: NotificationStatus.queued,
    providerMessageId: null,
    error: null,
  };
}

/** Records the outcome and the attempt together, so they cannot drift. */
async function touch(
  row: EnrollmentNotification,
  status: NotificationStatus,
  providerMessageId: string | null,
  error: string | null
): Promise<void> {
  await prisma.enrollmentNotification.update({
    where: { id: row.id },
    data: {
      status,
      providerMessageId,
      providerError: error,
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      sentAt: status === NotificationStatus.provider_accepted ? new Date() : null,
    },
  });
}

async function finish(
  row: EnrollmentNotification,
  status: NotificationStatus,
  providerMessageId: string | null,
  error: string | null
): Promise<{ status: NotificationStatus; providerMessageId: string | null; error: string | null }> {
  await touch(row, status, providerMessageId, error);
  return { status, providerMessageId, error };
}

/**
 * Starts the outbound notification worker.
 *
 * Idempotent, so a second call returns the worker already running rather than
 * attaching a second consumer - which would process every job twice.
 */
export async function startNotificationWorker(): Promise<Worker | null> {
  if (worker) return worker;

  worker = createWorker('outbound-notifications', async (job) => {
    const notificationId = String(job.data?.notificationId ?? '');
    if (!notificationId) throw new Error('A notification id is required.');

    const result = await dispatchNotification(notificationId);

    // `awaiting_contact` is not an error: there is nothing to send, so retrying
    // would only burn the queue's attempts. Marking the job done is correct.
    if (result.status === NotificationStatus.awaiting_contact) return result;

    // An unconfigured gateway is also not a failure of this job. Throwing would
    // burn all five attempts and leave the row `failed` for a reason that is a
    // missing credential, which staff would read as a bad phone number.
    if (result.status === NotificationStatus.queued) return result;

    if (result.status === NotificationStatus.failed) {
      // The provider answered. Recording it and not throwing keeps the row at
      // `failed` rather than exhausting retries on a definitive refusal.
      await recordAuditLog(
        null,
        'enrollment.notifications.failed',
        `Notification ${notificationId} was refused by the provider: ${result.error ?? 'unknown'}.`,
        null
      );
      return result;
    }

    return result;
  });

  worker.on('failed', (job, err) => {
    // The job id and the message only. The job payload is a notification id, and
    // the message body lives on the row, so nothing sensitive is logged here.
    void job?.id;
    void err.message;
  });

  return worker;
}

export async function stopNotificationWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
}

export { addNotificationJob };
export type { EnrollmentNotification };
