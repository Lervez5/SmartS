import "dotenv/config";
import http from "http";
import app from "./app";
import { logger } from "./shared/logger";
import { connectDatabase, disconnectDatabase } from "./infrastructure/database";
import { connectRedis, disconnectRedis } from "./infrastructure/redis";
import { config } from "./config";
import { initSocket } from "./shared/socket";

async function main(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  const server = http.createServer(app);
  initSocket(server);

  const PORT = config.port;
  server.listen(PORT, () => {
    logger.info("API server listening", { event: "server_started", port: PORT, env: config.env });
  });

  const shutdown = async (): Promise<void> => {
    logger.info("Shutting down gracefully...");
    server.close(() => {
      logger.info("Server closed");
    });
    await disconnectDatabase();
    await disconnectRedis();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.error("Failed to start server", { error: err });
  process.exit(1);
});
