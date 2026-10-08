import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../shared/logger';

declare global {
  var prisma: PrismaClient | undefined;
}

let prismaClient: PrismaClient;

/**
 * Query logging is opt-in because it is extremely noisy; enable it with
 * PRISMA_LOG_QUERIES=true when debugging a slow or incorrect query.
 */
const prismaLog: Array<'query' | 'error' | 'warn'> = process.env.PRISMA_LOG_QUERIES
  ? ['query', 'error', 'warn']
  : ['error', 'warn'];

if (process.env.NODE_ENV === 'production') {
  prismaClient = new PrismaClient({
    log: prismaLog,
    datasources: {
      db: { url: config.database.url },
    },
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: prismaLog,
      datasources: {
        db: { url: config.database.url },
      },
    });
  }
  prismaClient = global.prisma as PrismaClient;
}

export const prisma = prismaClient;

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected', {
      event: 'db_connected',
      url: config.database.url,
    });
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected', { event: 'db_disconnected' });
  } catch (error) {
    logger.error('Failed to disconnect from database', { error });
  }
}
