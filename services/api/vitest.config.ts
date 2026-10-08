import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(__dirname, '../../');

export default defineConfig({
  resolve: {
    alias: {
      '@schoolos/auth': resolve(root, 'packages/auth/src'),
      '@schoolos/auth/roles': resolve(root, 'packages/auth/src/roles'),
      '@schoolos/auth/permissions': resolve(root, 'packages/auth/src/permissions'),
      '@schoolos/types': resolve(root, 'packages/types/src'),
      '@schoolos/validation': resolve(root, 'packages/validation/src'),
      '@schoolos/utils': resolve(root, 'packages/utils/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // Runs once before any worker: keeps the test database's permission
    // catalogue in step with packages/auth.
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    // The three suite files share one test database, so running them in
    // parallel would interleave writes.
    fileParallelism: false,
    env: {
      DATABASE_URL: 'mongodb://localhost:27017/schoolos_test?replicaSet=rs0',
      RATE_LIMIT_SCALE: '50',
    },
  },
});
