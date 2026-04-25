import { Queue } from 'bullmq';
import { redisClient } from './redis';

export const aiQueue = new Queue('ai-jobs', {
  connection: redisClient,
});

export const emailQueue = new Queue('email-jobs', {
  connection: redisClient,
});
