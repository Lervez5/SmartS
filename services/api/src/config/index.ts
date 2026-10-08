import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

// The workspace keeps a single .env at the repo root. This module must load it
// before parsing, and ESM hoists imports, so the loading lives here rather than
// in the server entrypoint.
const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(here, '../../../../.env');
if (existsSync(rootEnv)) {
  loadEnv({ path: rootEnv });
} else {
  loadEnv();
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url().default('mongodb://localhost:27017/schoolos?replicaSet=rs0'),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_TOKEN_TTL: z.string().default('15m'),
  JWT_REFRESH_TOKEN_TTL: z.string().default('7d'),
  CORS_ORIGIN: z
    .string()
    .default(
      'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003'
    ),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('./uploads'),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().default('School OS <noreply@school.example>'),
  APP_CURRENCY: z.string().default('KES'),
  APP_CURRENCY_SYMBOL: z.string().default('KSh'),
  APP_CURRENCY_MINOR_UNIT: z.string().default('cents'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@school.example'),
  SEED_ADMIN_PASSWORD: z.string().default('supersecret'),
  APP_PARENT_URL: z.string().url().default('http://localhost:3002'),
  APP_STUDENT_URL: z.string().url().default('http://localhost:3000'),
  APP_TEACHER_URL: z.string().url().default('http://localhost:3001'),
  APP_ADMIN_URL: z.string().url().default('http://localhost:3003'),
});

const parsed = envSchema.parse(process.env);

export const config = {
  env: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === 'production',
  port: parsed.PORT,
  database: {
    url: parsed.DATABASE_URL,
  },
  jwt: {
    accessSecret: parsed.JWT_ACCESS_SECRET,
    refreshSecret: parsed.JWT_REFRESH_SECRET,
    accessTokenTtl: parsed.JWT_ACCESS_TOKEN_TTL,
    refreshTokenTtl: parsed.JWT_REFRESH_TOKEN_TTL,
  },
  cors: {
    origins: parsed.CORS_ORIGIN.split(',').map((o) => o.trim()),
  },
  redis: {
    url: parsed.REDIS_URL,
  },
  storage: {
    provider: parsed.STORAGE_PROVIDER,
    localRoot: parsed.STORAGE_LOCAL_ROOT,
    s3Bucket: parsed.STORAGE_S3_BUCKET,
    s3Region: parsed.STORAGE_S3_REGION,
    s3AccessKeyId: parsed.STORAGE_S3_ACCESS_KEY_ID,
    s3SecretAccessKey: parsed.STORAGE_S3_SECRET_ACCESS_KEY,
  },
  email: {
    resendApiKey: parsed.RESEND_API_KEY,
    fromEmail: parsed.FROM_EMAIL,
  },
  currency: {
    code: parsed.APP_CURRENCY,
    symbol: parsed.APP_CURRENCY_SYMBOL,
    minorUnit: parsed.APP_CURRENCY_MINOR_UNIT,
  },
  seed: {
    adminEmail: parsed.SEED_ADMIN_EMAIL,
    adminPassword: parsed.SEED_ADMIN_PASSWORD,
  },
  urls: {
    parent: parsed.APP_PARENT_URL,
    student: parsed.APP_STUDENT_URL,
    teacher: parsed.APP_TEACHER_URL,
    admin: parsed.APP_ADMIN_URL,
  },
} as const;

export const toMinorUnits = (amount: number): number => {
  const factor = config.currency.minorUnit === 'cents' ? 100 : 1;
  return Math.round(amount * factor);
};

export const fromMinorUnits = (amount: number): number => {
  const factor = config.currency.minorUnit === 'cents' ? 100 : 1;
  return amount / factor;
};

export type Config = typeof config;
