import { defineConfig } from "prisma/config";
import { PrismaClientOptions } from "prisma";

export default defineConfig({
  schema: "./schema.prisma",
  datasourceUrl: process.env.DATABASE_URL,
});
