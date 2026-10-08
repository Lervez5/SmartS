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

/**
 * The API origin, used to proxy uploaded files.
 *
 * Branding images are saved as a path such as `/uploads/branding/<school>/cover/x.jpg`
 * because the API serves them from its own origin, and the browser resolves a
 * relative `src` against the portal that served the page. Without a proxy for
 * that prefix the sign-in photograph 404s on every portal. Derived from the same
 * variable as the `/api` rewrite so the two cannot drift apart.
 */
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const apiOrigin = /^https?:\/\//i.test(apiBase)
  ? apiBase.replace(/\/api\/?$/, '')
  : 'http://localhost:4000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: Object.keys(workspaceAliases),
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, ...workspaceAliases };
    return config;
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
    NEXT_PUBLIC_APP_NAME: 'Teacher Portal',
    NEXT_PUBLIC_PORTAL: 'teacher',
    NEXT_PUBLIC_PORT: '3001',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/:path*`,
      },
      {
        // Uploaded branding images are stored as `/uploads/...` and served by
        // the API, so the portal has to proxy that prefix as well.
        source: '/uploads/:path*',
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
