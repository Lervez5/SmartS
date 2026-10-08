import { PrismaClient } from '@prisma/client';
import { config } from '../config';
import { logger } from '../shared/logger';

/**
 * A private client, rather than the shared one from `infrastructure/database`.
 *
 * This script deliberately runs commands that fail - dropping an index that is
 * already gone is the normal case - and the shared client logs every raw-command
 * failure at error level, so a database in perfect shape would print alarming
 * noise. The shared client is built at import time from the environment, so
 * toggling a log flag around the calls would come too late to matter.
 */
const prisma = new PrismaClient({
  log: [],
  datasources: { db: { url: config.database.url } },
});

/**
 * Reconciles the MongoDB indexes Prisma does not manage.
 *
 * Prisma's MongoDB connector never creates unique indexes. `@@unique` and
 * `@unique` are enforced by the client at query time, and only plain `@@index`
 * entries reach the server. Unique indexes left in the database therefore come
 * from somewhere else, and when they disagree with the schema they fail writes
 * in ways that look like application bugs.
 *
 * Two failures were found here, both invisible in `prisma validate` because the
 * schema itself was correct and the database was not.
 *
 * 1. `Class.classCode` carried a global unique index from a schema revision that
 *    declared it `@unique`. The schema now scopes it to the school
 *    (`@@unique([schoolId, classCode])`), so the index blocked two schools from
 *    both running PP1. Because `classCode` is optional and a unique index
 *    indexes `null` exactly once, it also allowed only one class in the whole
 *    database to have no code at all.
 *
 * 2. `Subject.name` and `Subject.code` had the same problem, while the schema
 *    scopes both to the school.
 *
 * Optional-but-unique fields get a partial unique index instead: still unique
 * when a value is present, but unlimited documents may omit it. Five models
 * (`Course`, `ExpenseCategory`, `LibraryBook`, `Asset`, `School`) had a strict
 * unique index on an optional field and hit the same single-null ceiling.
 *
 * Every action here is idempotent, so this is safe to run against a database
 * that is already correct, and `db:check` runs it to keep a fresh checkout from
 * silently inheriting the broken indexes.
 */

type IndexSpec = {
  /** Prisma model name, which is the MongoDB collection name. */
  collection: string;
  name: string;
  key: Record<string, 1>;
  unique?: boolean;
  /** Set only for optional fields, to exempt documents that omit the value. */
  partialOn?: string;
  /** A raw partial filter, for indexes that cover part of a collection. */
  partial?: Record<string, unknown>;
};

/** Indexes that must not exist, because they contradict the schema. */
const DROPPED: Array<{ collection: string; name: string; why: string }> = [
  {
    collection: 'Class',
    name: 'Class_classCode_key',
    why: 'global unique on an optional code; the schema scopes it to the school',
  },
  {
    collection: 'Subject',
    name: 'Subject_name_key',
    why: 'global unique on a school-scoped name',
  },
  {
    collection: 'Subject',
    name: 'Subject_code_key',
    why: 'global unique on a school-scoped, optional code',
  },
];

const REQUIRED: IndexSpec[] = [
  { collection: 'Class', name: 'schoolId_1_classCode_1', key: { schoolId: 1, classCode: 1 } },
  { collection: 'Subject', name: 'schoolId_1_name_1', key: { schoolId: 1, name: 1 } },
  { collection: 'Subject', name: 'schoolId_1_code_1', key: { schoolId: 1, code: 1 } },

  // Optional fields: partial so that omitting the value stays legal.
  {
    collection: 'Course',
    name: 'Course_code_key',
    key: { code: 1 },
    unique: true,
    partialOn: 'code',
  },
  {
    collection: 'ExpenseCategory',
    name: 'ExpenseCategory_code_key',
    key: { code: 1 },
    unique: true,
    partialOn: 'code',
  },
  {
    collection: 'LibraryBook',
    name: 'LibraryBook_isbn_key',
    key: { isbn: 1 },
    unique: true,
    partialOn: 'isbn',
  },
  { collection: 'Asset', name: 'Asset_tag_key', key: { tag: 1 }, unique: true, partialOn: 'tag' },
  {
    collection: 'School',
    name: 'School_schoolCode_key',
    key: { schoolCode: 1 },
    unique: true,
    partialOn: 'schoolCode',
  },

  /*
   * A stream may have many assistant and learning-area teachers, but only one
   * main class teacher, per academic session. The service checks this too, so a
   * caller gets a readable 409 rather than a database error, but the rule is
   * structural: two concurrent requests would otherwise both pass the check and
   * one would win, leaving the loser reporting success. Partial, so only active
   * main-teacher rows compete, and keyed on the session so last year's teacher
   * does not block this year's.
   */
  {
    collection: 'StreamAllocation',
    name: 'one_active_main_teacher_per_stream_session',
    key: { streamId: 1, academicYearId: 1 },
    unique: true,
    partial: { responsibility: 'main_class_teacher', status: 'active' },
  },
];

type CreateResult = {
  ok?: number;
  /** Present when the server created the index; equal to `numIndexesBefore` when it already existed. */
  numIndexesBefore?: number;
  numIndexesAfter?: number;
};

const runCommand = prisma.$runCommandRaw.bind(prisma) as unknown as (
  command: Record<string, unknown>
) => Promise<CreateResult>;

/**
 * The MongoDB server code carried by a failed command, e.g. `86:IndexKeySpecsConflict`.
 *
 * Prisma reports every raw-command failure as `P2010` with code `unknown` and
 * only the message distinguishes them, so the message is parsed. This is the
 * reason the script classifies outcomes by server code instead of reading
 * `listIndexes` first: Prisma's BSON decoder throws `Unknown tagged value` on
 * `partialFilterExpression`, which made a listing-based check silently report
 * every partial index as absent.
 */
function serverCode(error: unknown): string | null {
  const message = error instanceof Error ? error.message : String(error);
  const match = message.replace(/\s+/g, ' ').match(/Error code (\d+) \((\w+)\)/);
  return match ? `${match[1]}:${match[2]}` : null;
}

/** Server codes that mean "the thing you named was not there". */
const NOT_FOUND = new Set(['26:NamespaceNotFound', '27:IndexNotFound']);

async function dropIndex(collection: string, name: string): Promise<boolean> {
  try {
    await runCommand({ dropIndexes: collection, index: name });
    return true;
  } catch (error) {
    if (NOT_FOUND.has(serverCode(error) ?? '')) return false;
    throw error;
  }
}

export async function ensureIndexes(): Promise<{ dropped: number; created: number }> {
  let dropped = 0;
  let created = 0;

  for (const spec of DROPPED) {
    if (await dropIndex(spec.collection, spec.name)) {
      logger.info(`Dropped ${spec.collection}.${spec.name} (${spec.why})`);
      dropped += 1;
    }
  }

  for (const spec of REQUIRED) {
    const index: Record<string, unknown> = { key: spec.key, name: spec.name };
    if (spec.unique) index.unique = true;
    if (spec.partialOn) {
      index.partialFilterExpression = { [spec.partialOn]: { $type: 'string' } };
    }
    if (spec.partial) {
      index.partialFilterExpression = spec.partial;
    }

    let result: CreateResult;
    try {
      result = await runCommand({ createIndexes: spec.collection, indexes: [index] });
    } catch (error) {
      // The name exists with different options, which is the stale-index state.
      // Replace it rather than leaving the schema and database in disagreement.
      if (serverCode(error) !== '86:IndexKeySpecsConflict') throw error;

      logger.info(`Replacing stale ${spec.collection}.${spec.name}`);
      await dropIndex(spec.collection, spec.name);
      result = await runCommand({ createIndexes: spec.collection, indexes: [index] });
    }

    if (result.numIndexesAfter !== undefined && result.numIndexesAfter > result.numIndexesBefore!) {
      logger.info(`Created ${spec.collection}.${spec.name}`);
      created += 1;
    }
  }

  return { dropped, created };
}

/**
 * Fails when a known-contradicting index is still present.
 *
 * Presence is detected by dropping, because `listIndexes` cannot read back a
 * partial index through Prisma. Dropping is the intended outcome anyway, so the
 * check and the fix are the same operation.
 */
export async function assertIndexesSafe(): Promise<boolean> {
  let safe = true;

  for (const spec of DROPPED) {
    if (await dropIndex(spec.collection, spec.name)) {
      logger.error(
        `✗ ${spec.collection}.${spec.name} existed and was dropped (${spec.why}). ` +
          `Re-run \`pnpm db:indexes\` to reconcile.`
      );
      safe = false;
    }
  }

  return safe;
}

async function main(): Promise<void> {
  logger.info('Ensuring MongoDB indexes...');
  const { dropped, created } = await ensureIndexes();
  logger.info(`Indexes reconciled (${dropped} dropped, ${created} created).`);
}

main()
  .catch((error) => {
    logger.error('Index reconciliation failed', { error });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
