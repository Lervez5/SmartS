import Redis from 'ioredis';
import { config } from '../../config';
import { logger } from '../../shared/logger';

declare global {
  var redis: Redis | undefined;
}

let client: Redis;

if (process.env.NODE_ENV === 'production') {
  client = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
  });
} else {
  if (!global.redis) {
    global.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
    });
  }
  client = global.redis as Redis;
}

export const redisClient = client;

export async function connectRedis(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    client.on('error', (err: Error) => {
      logger.error('Redis error', { error: err });
      reject(err);
    });
    client.on('connect', () => {
      logger.info('Redis connected', {
        event: 'redis_connected',
        url: config.redis.url,
      });
      resolve();
    });

    if (client.status === 'ready' || client.status === 'connect') {
      resolve();
    }
  });
}

export async function disconnectRedis(): Promise<void> {
  await client.quit();
  logger.info('Redis disconnected', { event: 'redis_disconnected' });
}
