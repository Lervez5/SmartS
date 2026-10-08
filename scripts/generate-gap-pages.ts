/**
 * Generates the gap screens for navigation entries that have a route but no
 * backend capability.
 *
 * Each generated page is a thin client component that resolves its metadata
 * from the central navigation registry, so the gap text always matches what
 * `navigation.ts` declares. Re-running this after a registry change keeps the
 * pages in sync without hand-editing dozens of files.
 *
 * Run with: pnpm gen:gap-pages
 */

import { mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAVIGATION, type NavItem, type AppId } from '../packages/auth/src/navigation';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Item ids that have a real hand-written page and must not receive a stub. */
const IMPLEMENTED: Record<string, Set<string>> = {
  student: new Set([
    'stu.dashboard',
    'stu.profile',
    'stu.courses',
    'stu.attendance',
    'stu.calendar',
    'stu.settings',
  ]),
  teacher: new Set([
    'tea.dashboard',
    'tea.profile',
    'tea.courses',
    'tea.attendance',
    'tea.calendar',
    'tea.settings',
  ]),
  parent: new Set([
    'par.dashboard',
    'par.profile',
    'par.children',
    'par.attendance',
    'par.calendar',
    'par.settings',
  ]),
  admin: new Set([
    'adm.dashboard',
    'adm.profile',
    'adm.learners',
    'adm.classes',
    'adm.courses',
    'adm.staff',
    'adm.examinations',
    'adm.invoices',
    'adm.finance-summary',
    'adm.library',
    'adm.transport',
    'adm.users',
    'adm.roles',
    'adm.invitations',
    'adm.settings',
    'adm.reports',
  ]),
};

const DEFAULT_ROLE: Record<string, string> = {
  student: 'STUDENT',
  teacher: 'TEACHER',
  parent: 'PARENT',
  admin: 'DEAN',
};

function template(item: NavItem, app: AppId): string {
  return `"use client";

import { useAuth } from "@schoolos/auth";
import { GapScreen } from "@schoolos/ui";

/**
 * ${item.label} - ${app} portal.
 *
 * The navigation entry and this route exist so the CBC platform shape is
 * visible. The backend capability is not implemented:
 *
 *   ${item.gap}
 *
 * The page states the gap rather than rendering an empty table, which would
 * read as "no data yet" when in fact no endpoint exists.
 */
export default function Page() {
  const { user, permissions } = useAuth();

  return (
    <GapScreen
      app="${app}"
      path="${item.href}"
      permissions={permissions}
      role={(user?.role ?? "${DEFAULT_ROLE[app]}") as never}
      title="${item.label}"
    />
  );
}
`;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  let created = 0;
  let preserved = 0;

  for (const [app, sections] of Object.entries(NAVIGATION) as Array<
    [AppId, (typeof NAVIGATION)[AppId]]
  >) {
    const done = IMPLEMENTED[app] ?? new Set<string>();
    const appDir = join(repoRoot, 'apps', app, 'src/app/(shell)');

    for (const section of sections) {
      for (const item of section.items) {
        if (item.implemented !== false) continue;
        if (done.has(item.id)) continue;

        // Use the href verbatim. Admin navigation hrefs are absolute from the
        // portal root ("/admin/...") and the admin app serves exactly that
        // path, so the file belongs under `(shell)/admin/...`. Stripping the
        // prefix here created a second, unreachable route tree beside the real
        // one.
        const target = join(appDir, item.href, 'page.tsx');
        if (await exists(target)) {
          preserved += 1;
          continue;
        }

        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, template(item, app), 'utf8');
        created += 1;
        console.log(`created  ${app}${item.href}`);
      }
    }
  }

  console.log(`\n${created} gap pages created, ${preserved} left untouched.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
