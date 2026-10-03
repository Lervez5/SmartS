import argon2 from 'argon2';
import { config } from '../config';
import { logger } from '../shared/logger';
import { prisma } from '../infrastructure/database';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@schoolos/auth/permissions';
import { ROLES, type UserRole } from '@schoolos/auth/roles';
import { provisionSchoolSettings } from '../modules/settings/service';
import { ensureCompetencyBands } from '../modules/academics/grading';

/**
 * Seeds the canonical role/permission catalogue into MongoDB and creates one
 * development account per role.
 *
 * Role and permission values are imported from packages/auth so the API, the
 * seed and the frontends cannot drift apart.
 */

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  SUPER_ADMIN: 'Full system administration',
  ACCOUNTANT: 'Finance operations',
  DEAN: 'Academic leadership and assessment oversight',
  TEACHER: 'Teaching staff',
  PARENT: 'Parent or guardian',
  STUDENT: 'Enrolled student',
};

const FIXTURES: Array<{ email: string; name: string; role: UserRole }> = [
  {
    email: config.seed.adminEmail,
    name: 'System Administrator',
    role: 'SUPER_ADMIN',
  },
  { email: 'dean@school.example', name: 'Dana Dean', role: 'DEAN' },
  {
    email: 'accountant@school.example',
    name: 'Alex Accountant',
    role: 'ACCOUNTANT',
  },
  { email: 'teacher@school.example', name: 'Grace Teacher', role: 'TEACHER' },
  { email: 'parent@school.example', name: 'Pat Parent', role: 'PARENT' },
  { email: 'student@school.example', name: 'Sam Student', role: 'STUDENT' },
];

const PROFILE_FOR: Partial<Record<UserRole, 'student' | 'staff'>> = {
  STUDENT: 'student',
  TEACHER: 'staff',
  DEAN: 'staff',
  ACCOUNTANT: 'staff',
};

async function seedRolesAndPermissions() {
  for (const key of PERMISSIONS) {
    const [domain, action] = key.split('.');
    await prisma.permission.upsert({
      where: { key },
      update: { name: action, domain },
      create: { key, name: action, domain },
    });
  }
  logger.info('Permissions seeded', { count: PERMISSIONS.length });

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role },
      update: { description: ROLE_DESCRIPTIONS[role] },
      create: { name: role, description: ROLE_DESCRIPTIONS[role] },
    });
  }
  logger.info('Roles seeded', { count: ROLES.length });

  // Recreate grants so the catalogue stays authoritative.
  await prisma.rolePermission.deleteMany({});
  const roles = await prisma.role.findMany();
  const permissions = await prisma.permission.findMany();

  const roleByName = new Map(roles.map((r) => [r.name, r.id]));
  const permByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const rows: Array<{ roleId: string; permissionId: string }> = [];
  for (const [role, grants] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleByName.get(role as UserRole);
    if (!roleId) continue;
    for (const key of grants) {
      const permissionId = permByKey.get(key);
      if (permissionId) rows.push({ roleId, permissionId });
    }
  }
  if (rows.length) await prisma.rolePermission.createMany({ data: rows });
  logger.info('Role permissions seeded', { count: rows.length });

  // Retire legacy role rows (super_admin, school_admin, teacher, ...) left over
  // from the pre-migration model. Mappings for them live in
  // LEGACY_ROLE_ALIASES; the canonical membership is created by seedUsers.
  const legacyRoles = await prisma.role.findMany({
    where: { name: { notIn: [...ROLES] } },
    select: { id: true, name: true },
  });
  if (legacyRoles.length) {
    await prisma.userRoleMembership.deleteMany({
      where: { roleId: { in: legacyRoles.map((r) => r.id) } },
    });
    await prisma.role.deleteMany({
      where: { id: { in: legacyRoles.map((r) => r.id) } },
    });
    logger.info('Legacy roles retired', {
      roles: legacyRoles.map((r) => r.name),
    });
  }
}

async function seedUsers() {
  const passwordHash = await argon2.hash(config.seed.adminPassword);

  for (const fixture of FIXTURES) {
    const existing = await prisma.user.findUnique({
      where: { email: fixture.email },
      include: { roleMemberships: true },
    });

    if (existing) {
      // Keep the fixture authoritative so re-seeding repairs drift: an account
      // created by an older seed (or a hand-edited password) must still be
      // usable by the development credentials.
      let passwordOk = true;
      if (existing.passwordHash) {
        const { default: argon2 } = await import('argon2');
        passwordOk = await argon2
          .verify(existing.passwordHash, config.seed.adminPassword)
          .catch(() => false);
      }
      if (!passwordOk) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, status: 'active' },
        });
        logger.info('Password re-synced for existing user', {
          email: fixture.email,
        });
      }

      // Ensure the canonical role membership is present even for older rows.
      const role = await prisma.role.findUnique({
        where: { name: fixture.role },
      });
      if (role && !existing.roleMemberships.some((m) => m.roleId === role.id)) {
        await prisma.userRoleMembership.create({
          data: { userId: existing.id, roleId: role.id },
        });
        logger.info('Role membership added to existing user', {
          email: fixture.email,
          role: fixture.role,
        });
      }
      continue;
    }

    const profile = PROFILE_FOR[fixture.role];

    await prisma.user.create({
      data: {
        email: fixture.email,
        name: fixture.name,
        passwordHash,
        status: 'active',
        roleMemberships: {
          create: { role: { connect: { name: fixture.role } } },
        },
        ...(profile === 'student' ? { studentProfile: { create: { gradeLevel: 'Grade 5' } } } : {}),
        ...(profile === 'staff'
          ? {
              staffProfile: {
                create: { position: ROLE_DESCRIPTIONS[fixture.role] },
              },
            }
          : {}),
      },
    });

    logger.info('User created', { email: fixture.email, role: fixture.role });
  }
}

/**
 * Provision every configuration area for the provisioned school.
 *
 * A read already falls back to defaults, so this is not about making the pages
 * render - it is about the school actually being complete. Without it the two
 * areas nobody opens, subscription and glow, never get a record, and there is
 * nothing for an administrator to administer.
 *
 * Idempotent and non-destructive: an area that already has a record keeps the
 * administrator's configuration untouched.
 */
async function seedSchoolSettings(): Promise<void> {
  const school = await prisma.school.findFirst();
  if (!school) {
    logger.warn('No school provisioned yet; skipping school settings.');
    return;
  }
  const bands = await ensureCompetencyBands(school.id);
  logger.info('CBC competency bands ready', {
    school: school.name,
    bands: bands.length,
  });

  const result = await provisionSchoolSettings(school.id);
  if (result.created.length > 0) {
    logger.info('School settings provisioned', {
      school: school.name,
      created: result.created,
      kept: result.skipped,
    });
  } else {
    logger.info('School settings already complete', { school: school.name });
  }
}

async function seed() {
  logger.info('Starting seed...');
  await seedRolesAndPermissions();
  await seedUsers();
  await seedSchoolSettings();
  logger.info('Seed complete.', { password: config.seed.adminPassword });
}

seed()
  .catch((err) => {
    logger.error('Seed failed', { error: err });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
