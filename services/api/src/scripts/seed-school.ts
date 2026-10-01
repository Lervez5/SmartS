import argon2 from 'argon2';
import { config } from '../config';
import { logger } from '../shared/logger';
import { prisma } from '../infrastructure/database';

/**
 * Provisions the school every platform record is scoped to, and attaches each
 * development account to it. Separate from the role seed: that one owns the
 * authorization model, this one owns the institution.
 */
const EMAIL = [
  'admin@school.example',
  'dean@school.example',
  'accountant@school.example',
  'teacher@school.example',
  'parent@school.example',
  'student@school.example',
];

async function main() {
  logger.info('Seeding school...');

  let school = await prisma.school.findFirst();
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: 'Greenfield Academy',
        displayName: 'Greenfield Academy',
        schoolCode: 'GFA',
        schoolType: 'Day Secondary',
        schoolLevel: 'Secondary',
        curriculum: 'CBC',
        status: 'ACTIVE',
      },
    });
    logger.info('School created', { id: school.id, name: school.name });
  } else {
    logger.info('School already exists', { id: school.id, name: school.name });
  }

  for (const email of EMAIL) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      logger.info('No such user, skipping', { email });
      continue;
    }
    const membership = await prisma.schoolMembership.findFirst({
      where: { userId: user.id, schoolId: school.id },
    });
    if (!membership) {
      await prisma.schoolMembership.create({
        data: { userId: user.id, schoolId: school.id, isDefault: true },
      });
      logger.info('Attached to school', { email });
    }
  }

  logger.info('School seed complete.');
}

main()
  .catch((err) => {
    logger.error('School seed failed', { error: err });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
void argon2;
void config;
