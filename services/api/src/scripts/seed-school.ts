import argon2 from 'argon2';
import { config } from '../config';
import { logger } from '../shared/logger';
import { prisma } from '../infrastructure/database';
import { provisionSchoolSettings } from '../modules/settings/service';

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

/**
 * Seeds an active academic session (AcademicYear) with its terms for the school.
 *
 * The session selector mounted in every portal's navbar reads its options from
 * `GET /api/academic-sessions`, which returns AcademicYear records scoped to the
 * authenticated user's school. Without a single seeded session that list is
 * empty, so every portal - including the parent - renders "No academic session
 * set". Creating one here lets that shared selector display a real session.
 *
 * Idempotent: a school that already has sessions is left untouched, so any
 * session an administrator creates later survives a re-seed.
 */
async function ensureAcademicSessions(schoolId: string) {
  const count = await prisma.academicYear.count({ where: { schoolId } });
  if (count > 0) {
    logger.info('Academic sessions already exist', { schoolId, count });
    return;
  }

  const settings = await prisma.schoolAcademicSettings.findUnique({
    where: { schoolId },
    select: { termsPerYear: true },
  });
  const termsPerYear = settings?.termsPerYear ?? 3;

  const now = new Date();
  const year = now.getUTCFullYear();
  const startDate = new Date(Date.UTC(year, 0, 1));
  const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const session = await prisma.academicYear.create({
    data: {
      schoolId,
      name: String(year),
      label: `${year} Academic Session`,
      startDate,
      endDate,
      status: 'active',
    },
  });

  const span = endDate.getTime() - startDate.getTime();
  const terms = Array.from({ length: termsPerYear }, (_, i) => ({
    academicYearId: session.id,
    name: `Term ${i + 1}`,
    termNumber: i + 1,
    startDate: new Date(startDate.getTime() + Math.round((span * i) / termsPerYear)),
    endDate: new Date(startDate.getTime() + Math.round((span * (i + 1)) / termsPerYear) - 1000),
    status: (i === 0 ? 'active' : 'planned') as 'planned' | 'active',
  }));

  await prisma.term.createMany({ data: terms });

  await prisma.schoolAcademicSettings.update({
    where: { schoolId },
    data: { currentAcademicYearId: session.name },
  });

  logger.info('Academic session seeded', {
    schoolId,
    sessionId: session.id,
    name: session.name,
    terms: termsPerYear,
  });
}

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

  // Provision every configuration area so a freshly seeded school is complete
  // and administrable, not just falling back to defaults on read.
  const provisioned = await provisionSchoolSettings(school.id);
  if (provisioned.created.length > 0) {
    logger.info('School settings provisioned', {
      created: provisioned.created,
      kept: provisioned.skipped,
    });
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

  await ensureAcademicSessions(school.id);

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
