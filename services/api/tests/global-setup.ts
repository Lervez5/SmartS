/**
 * Vitest global setup.
 *
 * Runs once, before any worker boots, so the permission catalogue in the test
 * database matches packages/auth. Doing this in a per-file `beforeAll` raced:
 * the three test files each deleted and re-created the same role grants in
 * parallel, which stripped permissions out from under a test mid-run and
 * produced spurious 403s.
 *
 * The env assignment must precede the Prisma import, and ESM hoists imports
 * above statements — so every runtime dependency is pulled in with a dynamic
 * `import()` after `process.env` is set. A static import here builds the client
 * against the repo-root .env (the main `schoolos` database) and silently syncs
 * the wrong database.
 */

process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'mongodb://localhost:27017/schoolos_test?replicaSet=rs0';
process.env.RATE_LIMIT_SCALE = process.env.RATE_LIMIT_SCALE || '50';

export async function setup(): Promise<void> {
  const [{ PERMISSIONS, ROLE_PERMISSIONS }, { prisma }] = await Promise.all([
    import('@schoolos/auth/permissions'),
    import('../src/infrastructure/database'),
  ]);

  try {
    for (const key of PERMISSIONS) {
      const [domain] = key.split('.');
      await prisma.permission.upsert({
        where: { key },
        update: { domain },
        create: { key, name: key, domain },
      });
    }

    const permissions = await prisma.permission.findMany();
    const byKey = new Map(permissions.map((p) => [p.key, p.id]));

    for (const [roleName, grants] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) continue;

      // Authoritative for the test database: replace the grant set outright.
      // A stale grant from a removed permission would otherwise make the suite
      // assert against permissions the catalogue no longer declares. This is
      // safe only because it runs against `schoolos_test`.
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

      const rows = grants
        .map((key) => byKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId }));

      if (rows.length > 0) {
        // No `skipDuplicates`: the MongoDB provider does not accept it. The
        // grant set was just replaced wholesale, so the rows are unique by
        // construction.
        await prisma.rolePermission.createMany({ data: rows });
      }
    }

    const total = await prisma.rolePermission.count();
    console.log(`[test-setup] synced ${PERMISSIONS.length} permissions, ${total} role grants`);
  } catch (error) {
    // A cold database has no roles yet. The suite creates what it needs, so
    // this is a warning rather than a failure. The full cause is printed
    // because a silent skip looks identical to a successful sync.
    const err = error as Error;
    console.warn('[test-setup] permission sync skipped:', err?.message ?? String(error));
    if (err?.stack) console.warn(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}
