import { PrismaClient } from "@prisma/client";
import { config } from "../../config";
import { logger } from "../../shared/logger";

declare global {
  var prisma: PrismaClient | undefined;
}

let prismaClient: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prismaClient = new PrismaClient({
    log: ["query", "error", "warn"],
    datasources: {
      db: { url: config.database.url },
    },
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ["query", "error", "warn"],
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
    logger.info("Database connected", { event: "db_connected", url: config.database.url });
  } catch (error) {
    logger.error("Failed to connect to database", { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info("Database disconnected", { event: "db_disconnected" });
  } catch (error) {
    logger.error("Failed to disconnect from database", { error });
  }
}
