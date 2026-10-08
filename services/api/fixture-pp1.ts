/**
 * Verification fixture: a class at the scale the brief describes.
 *
 * PP1 divided into five streams with fifty-five learners each, so one class
 * holds 275 learners. Used to check that the register overview and marks entry
 * behave at a realistic class size rather than a demo one.
 */

import { prisma } from './src/infrastructure/database';
import argon2 from 'argon2';

const STREAMS = ['RED', 'BLUE', 'GREEN', 'YELLOW', 'WHITE'];
const PER_STREAM = 55;

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) throw new Error('no school provisioned');

  const teacher = await prisma.user.findUnique({
    where: { email: 'teacher@school.example' },
    select: { id: true },
  });
  const role = await prisma.role.findUnique({ where: { name: 'STUDENT' } });
  const hash = await argon2.hash('supersecret');

  let cls = await prisma.class.findFirst({ where: { schoolId: school.id, name: 'PP1' } });
  if (!cls) {
    cls = await prisma.class.create({
      // classCode deliberately omitted: this dev database still enforces the
      // pre-scoped global unique index, which Prisma cannot drop.
      data: { schoolId: school.id, name: 'PP1', gradeLevel: 'PP1', teacherId: teacher!.id },
    });
  }

  const streams = [];
  for (const code of STREAMS) {
    streams.push(
      await prisma.stream.upsert({
        where: { classId_code: { classId: cls.id, code } },
        update: {},
        create: { classId: cls.id, name: `Stream ${code}`, code },
      })
    );
  }

  for (const stream of streams) {
    for (let i = 0; i < PER_STREAM; i++) {
      const email = `pp1.${stream.code.toLowerCase()}${String(i + 1).padStart(2, '0')}@school.example`;
      const user = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          name: `PP1 ${stream.code} ${i + 1}`,
          passwordHash: hash,
          status: 'active',
          schoolMemberships: { create: { schoolId: school.id, isDefault: true } },
          roleMemberships: { create: { roleId: role!.id } },
          studentProfile: { create: { gradeLevel: 'PP1' } },
        },
      });
      await prisma.enrollment.upsert({
        where: { studentId_classId: { studentId: user.id, classId: cls.id } },
        update: { streamId: stream.id },
        create: { studentId: user.id, classId: cls.id, streamId: stream.id },
      });
    }
  }

  const total = await prisma.enrollment.count({ where: { classId: cls.id } });
  console.log(`PP1: ${total} learners across ${streams.length} streams`);
  console.log(`CLASS=${cls.id}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.log('ERR:', String(error).slice(0, 300));
  process.exit(1);
});
