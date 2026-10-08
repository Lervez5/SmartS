/** @type {import('next').NextConfig} */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at <repo>/apps/<app>/next.config.mjs.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Workspace packages are aliased to their source entry points.
 *
 * Without this, a package can be reached through two specifiers and webpack
 * will bundle two copies of it. For @schoolos/auth that means two zustand
 * stores: the session gate writes to one while the navbar reads the other, and
 * the UI silently renders as signed out.
 */
const workspaceAliases = {
  '@schoolos/auth': resolve(repoRoot, 'packages/auth/src'),
  '@schoolos/ui': resolve(repoRoot, 'packages/ui/src'),
  '@schoolos/utils': resolve(repoRoot, 'packages/utils/src'),
  '@schoolos/hooks': resolve(repoRoot, 'packages/hooks/src'),
  '@schoolos/types': resolve(repoRoot, 'packages/types/src'),
  '@schoolos/validation': resolve(repoRoot, 'packages/validation/src'),
};

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: Object.keys(workspaceAliases),
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, ...workspaceAliases };
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
    NEXT_PUBLIC_APP_NAME: 'Parent Portal',
    NEXT_PUBLIC_PORTAL: 'parent',
    NEXT_PUBLIC_PORT: '3002',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/:path*`,
      },
    ];
  },
};

export default nextConfig;
