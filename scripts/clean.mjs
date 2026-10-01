/**
 * Removes build output across the workspace.
 *
 * The failure this exists to prevent: `next dev` and `next build` both write to
 * `<app>/.next`. Running them at the same time corrupts the directory and the
 * build dies with `Cannot find module for page: /_document` and `EPIPE`, which
 * reads like a code error but is a cache collision.
 *
 * `pnpm clean` clears every app at once; `node scripts/clean.mjs admin` clears
 * one. Each app's `.next` is independent, so a single-app build never needs the
 * others cleaned.
 */

import { rm, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Directories removed per app, relative to `apps/<name>`. */
const APP_TARGETS = ['.next', 'out', '.turbo'];

/** Directories removed from each shared package. */
const PACKAGE_TARGETS = ['dist', '.turbo', 'tsconfig.tsbuildinfo'];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function cleanApp(app) {
  const appDir = join(repoRoot, 'apps', app);
  if (!(await exists(appDir))) return false;

  let removed = false;
  for (const target of APP_TARGETS) {
    const full = join(appDir, target);
    if (await exists(full)) {
      await rm(full, { recursive: true, force: true });
      console.log(`removed  apps/${app}/${target}`);
      removed = true;
    }
  }
  return removed;
}

async function cleanPackages() {
  const packagesDir = join(repoRoot, 'packages');
  const entries = await readdir(packagesDir, { withFileTypes: true }).catch(() => []);
  let removed = false;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const target of PACKAGE_TARGETS) {
      const full = join(packagesDir, entry.name, target);
      if (await exists(full)) {
        await rm(full, { recursive: true, force: true });
        console.log(`removed  packages/${entry.name}/${target}`);
        removed = true;
      }
    }
  }
  return removed;
}

async function main() {
  const only = process.argv[2];

  if (only) {
    const cleaned = await cleanApp(only);
    console.log(cleaned ? `\nCleaned ${only}.` : `\nNothing to clean for "${only}".`);
    return;
  }

  const apps = (await readdir(join(repoRoot, 'apps'), { withFileTypes: true }).catch(() => []))
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const app of apps) await cleanApp(app);
  await cleanPackages();

  console.log(`\nCleaned ${apps.length} apps and shared packages.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
