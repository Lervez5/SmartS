/**
 * Per-worker test setup.
 *
 * The test database URL has to be set before any app import, because
 * config/index.ts loads the repo-root .env at module scope. The permission
 * catalogue itself is synced once in `global-setup.ts` rather than here, since
 * a per-file sync would race across parallel workers.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/schoolos_test?replicaSet=rs0';
process.env.RATE_LIMIT_SCALE = process.env.RATE_LIMIT_SCALE || '50';
