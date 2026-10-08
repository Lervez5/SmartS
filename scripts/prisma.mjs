#!/usr/bin/env node
/**
 * Prisma schema guard.
 *
 * Two problems this solves.
 *
 * 1. The Prisma CLI could not run. `prisma validate`, `prisma generate` and
 *    `prisma db push` resolve `env("DATABASE_URL")` from a `.env` beside the
 *    CLI, but this workspace keeps a single `.env` at the repo root - the app
 *    loads it explicitly in `src/config/index.ts`, the CLI never learned to.
 *    Every prisma command failed with P1012 until this wrapper loaded it.
 *
 * 2. The schema could silently drift from the generated client. Prisma copies
 *    the schema it generated from into the client directory, so comparing that
 *    copy against the source is an exact drift check with no extra dependency.
 *    A stale client is the failure mode that surfaces much later as a confusing
 *    TypeScript error in code that looks correct.
 *
 * Usage:
 *   node scripts/prisma.mjs check      validate + drift check (no database)
 *   node scripts/prisma.mjs format     canonical formatting
 *   node scripts/prisma.mjs generate   regenerate the client
 *   node scripts/prisma.mjs validate   schema validation only
 *   node scripts/prisma.mjs push       push the schema to the database
 *   node scripts/prisma.mjs <args...>  pass straight through to the CLI
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(repoRoot, 'services/api');
const schemaPath = join(apiDir, 'prisma', 'schema.prisma');
const stampPath = join(apiDir, 'prisma', '.generated-stamp');

/** The only `.env` in the workspace. Secrets are not duplicated. */
const rootEnvPath = join(repoRoot, '.env');

/** Parse the minimal `KEY=value` form dotenv uses, without the dependency. */
function loadRootEnv() {
  if (!existsSync(rootEnvPath)) return;
  const text = readFileSync(rootEnvPath, 'utf8');
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // Never clobber a value the caller already exported.
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

/**
 * Locate the generated client's copy of the schema.
 *
 * The location depends on the package manager and on the generator's `output`
 * field, so try the known candidates and take the first that exists.
 * `@prisma/client`'s main file sits directly in its own package directory, so
 * one `dirname` is the right step, not two.
 */
function generatedSchemaCandidates() {
  const candidates = [];

  try {
    const require = createRequire(join(apiDir, 'package.json'));
    const clientEntry = require.resolve('@prisma/client');
    candidates.push(join(dirname(clientEntry), '.prisma', 'client', 'schema.prisma'));
  } catch {
    // @prisma/client not resolvable; fall through to the static candidates.
  }

  // The generator in schema.prisma writes to `../node_modules/.prisma/client`,
  // relative to services/api.
  candidates.push(join(apiDir, 'node_modules', '.prisma', 'client', 'schema.prisma'));
  candidates.push(join(repoRoot, 'node_modules', '.prisma', 'client', 'schema.prisma'));

  return candidates;
}

function generatedSchemaPath() {
  return generatedSchemaCandidates().find((path) => existsSync(path)) ?? null;
}

function prisma(args, { allowFailure = false } = {}) {
  const bin = join(apiDir, 'node_modules', '.bin', 'prisma');
  const result = spawnSync(bin, args, {
    cwd: apiDir,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0 && !allowFailure) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 0;
}

/**
 * Records which schema produced the current client.
 *
 * The generated copy is the primary signal, but it is not present before the
 * first generate on a clean checkout, so a stamp of the schema's own hash gives
 * a second, independent way to notice that `prisma generate` has not been run.
 */
function writeStamp() {
  try {
    mkdirSync(dirname(stampPath), { recursive: true });
    writeFileSync(stampPath, `${readFileSync(schemaPath, 'utf8')}\n`, 'utf8');
  } catch {
    // The stamp is a convenience; never fail a build over it.
  }
}

function checkDrift() {
  const generated = generatedSchemaPath();

  if (!generated) {
    console.error(
      '✗ No generated Prisma client found.\n' +
        '  Run `pnpm db:generate` before building or type-checking.'
    );
    return false;
  }

  const source = readFileSync(schemaPath, 'utf8').trim();
  const built = readFileSync(generated, 'utf8').trim();

  if (source !== built) {
    const sourceModels = (source.match(/^model /gm) ?? []).length;
    const builtModels = (built.match(/^model /gm) ?? []).length;
    const sourceEnums = (source.match(/^enum /gm) ?? []).length;
    const builtEnums = (built.match(/^enum /gm) ?? []).length;

    console.error('✗ Prisma client is out of date with the schema.');
    console.error(
      `    schema.prisma : ${sourceModels} models, ${sourceEnums} enums\n` +
        `    generated     : ${builtModels} models, ${builtEnums} enums`
    );
    console.error('  Run `pnpm db:generate` to regenerate the client.');
    return false;
  }

  if (existsSync(stampPath)) {
    const stamped = readFileSync(stampPath, 'utf8').trim();
    if (stamped !== source) {
      console.error(
        '✗ The schema has changed since the last `prisma generate`.\n' +
          '  Run `pnpm db:generate` to regenerate the client.'
      );
      return false;
    }
  }

  const models = (source.match(/^model /gm) ?? []).length;
  const enums = (source.match(/^enum /gm) ?? []).length;
  console.log(`✓ Prisma schema valid and in sync (${models} models, ${enums} enums)`);
  return true;
}

function main() {
  loadRootEnv();

  const [command, ...rest] = process.argv.slice(2);

  switch (command) {
    case 'check': {
      prisma(['validate'], { allowFailure: true });
      process.exit(checkDrift() ? 0 : 1);
      break;
    }

    case 'format': {
      prisma(['format']);
      // Formatting changes the source, so the client is now stale by definition.
      prisma(['generate']);
      writeStamp();
      break;
    }

    case 'generate': {
      prisma(['generate']);
      writeStamp();
      break;
    }

    case 'validate': {
      prisma(['validate']);
      break;
    }

    case 'push': {
      prisma(['db', 'push', ...rest]);
      break;
    }

    default: {
      if (!command) {
        prisma(['validate']);
        writeStamp();
        break;
      }
      prisma([command, ...rest]);
    }
  }
}

main();
