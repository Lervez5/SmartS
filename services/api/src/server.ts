import 'dotenv/config';
import http from 'http';
import app from './app';
import { logger } from './shared/logger';
import { connectDatabase, disconnectDatabase } from './infrastructure/database';
import { connectRedis, disconnectRedis } from './infrastructure/redis';
import { config } from './config';
import { initSocket } from './shared/socket';

/**
 * Start listening, rejecting on a listen failure.
 *
 * `server.listen` reports failures by emitting `'error'`, which happens after
 * the call returns. Without an `error` listener Node treats that as an
 * unhandled event and aborts with a raw stack trace, so the outer
 * `main().catch()` never runs and the operator sees
 * `throw er; // Unhandled 'error' event` instead of anything actionable.
 */
function listen(server: http.Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (error: NodeJS.ErrnoException): void => {
      server.removeListener('listening', onListening);

      if (error.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Port ${port} is already in use, so the API cannot start.\n` +
              `  Another copy of the API is probably still running - common after an ` +
              `interrupted run, or when a previous \`pnpm dev\` was not stopped.\n` +
              `  Find it:  lsof -ti:${port}          (macOS/Linux)\n` +
              `             netstat -ano | findstr :${port}   (Windows)\n` +
              `  Stop it:  kill $(lsof -ti:${port})   then start the API again.\n` +
              `  Or move it: set PORT in .env to a free port and update ` +
              `NEXT_PUBLIC_API_URL in the portal that calls it.`
          )
        );
        return;
      }

      if (error.code === 'EACCES') {
        reject(
          new Error(
            `Not permitted to bind port ${port}. Ports below 1024 need elevated privileges;\n` +
              `  pick one above 1024 and set PORT in .env.`
          )
        );
        return;
      }

      reject(error);
    };

    const onListening = (): void => {
      server.removeListener('error', onError);
      resolve();
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  const server = http.createServer(app);
  initSocket(server);

  const PORT = config.port;

  // Any error after this point is an operational problem, not a startup one.
  server.on('error', (error) => {
    logger.error('Server error', { error: error.message });
  });

  await listen(server, PORT);

  logger.info('API server listening', {
    event: 'server_started',
    port: PORT,
    env: config.env,
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down gracefully...');
    server.close(() => {
      logger.info('Server closed');
    });
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  // Startup failures are operator errors, so print the message plainly rather
  // than a stack trace, then keep the structured log for anything unexpected.
  logger.error('Failed to start server', { error: err instanceof Error ? err.message : err });
  if (!(err instanceof Error) || err.stack === undefined) {
    console.error(err);
  }
  process.exit(1);
});
