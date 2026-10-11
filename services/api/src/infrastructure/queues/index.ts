import { Queue, Worker, Job } from 'bullmq';
import { redisClient } from '../redis';
import { logger } from '../../shared/logger';

export interface JobData {
  [key: string]: unknown;
}

export function createQueue(name: string): Queue {
  return new Queue(name, {
    connection: redisClient,
  });
}

export function createWorker(name: string, processor: (job: Job) => Promise<unknown>): Worker {
  return new Worker(name, processor, {
    connection: redisClient,
  });
}

export const emailQueue = createQueue('email-jobs');

/**
 * Outbound guardian notifications - enrollment confirmations and activation
 * instructions, by SMS or email.
 *
 * Kept off the request path on purpose. A 500-row enrollment would otherwise
 * serialise 500 gateway round-trips inside the administrator's HTTP request, and
 * a slow or failing provider would make enrolling a learner appear to hang. The
 * queue's own retry and backoff also means a transient outage is retried without
 * anybody re-triggering anything.
 */
export const notificationQueue = createQueue('outbound-notifications');

export async function addNotificationJob(
  notificationId: string,
  options: { delay?: number } = {}
): Promise<void> {
  await notificationQueue.add(
    'send',
    { notificationId },
    {
      // The row carries its own idempotency key, so a queue retry cannot become
      // a second message: the worker re-reads the row and finds it already
      // handed over.
      attempts: 5,
      backoff: { type: 'exponential', delay: 10000 },
      ...(options.delay ? { delay: options.delay } : {}),
    }
  );
  logger.info('Notification queued', { event: 'notification_queued', notificationId });
}

export async function addEmailJob(
  to: string,
  template: string,
  payload: Record<string, unknown>
): Promise<void> {
  await emailQueue.add(
    template,
    { to, template, payload },
    {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    }
  );
  logger.info('Email job queued', { event: 'email_queued', to, template });
}
