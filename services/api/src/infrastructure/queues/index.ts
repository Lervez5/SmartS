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
