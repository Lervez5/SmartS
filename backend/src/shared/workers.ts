import { Worker } from 'bullmq';
import { redisClient } from './redis';
import { logger } from './logger';
import { predictSkill, recommendNext, scoreResponseAi } from '../modules/ai-engine-connector/service';
import { io } from './socket';
import { emailWorker } from '../modules/email/worker';

export const aiWorker = new Worker(
  'ai-jobs',
  async (job) => {
    logger.info('Processing AI job', { jobId: job.id, jobName: job.name });

    try {
      let result;
      switch (job.name) {
        case 'predict-skill':
          result = await predictSkill(job.data);
          break;
        case 'recommend-next':
          result = await recommendNext(job.data);
          break;
        case 'score-response':
          result = await scoreResponseAi(job.data);
          break;
        case 'generate-content':
          // This would be a new FastAPI endpoint, but for now we'll call recommendNext as a placeholder
          result = await recommendNext(job.data);
          break;
        default:
          logger.warn('Unknown job name in AI queue', { jobName: job.name });
          return;
      }

      // Notify the user via socket if they are connected
      if (io && job.data.userId) {
        io.to(`user:${job.data.userId}`).emit('ai_job_completed', {
          jobId: job.id,
          jobName: job.name,
          result,
        });
      }

      return result;
    } catch (error) {
      logger.error('Error processing AI job', { jobId: job.id, error });
      throw error;
    }
  },
  { connection: redisClient }
);

aiWorker.on('completed', (job) => {
  logger.info('AI job completed', { jobId: job.id });
});

aiWorker.on('failed', (job, err) => {
  logger.error('AI job failed', { jobId: job?.id, error: err });
});
