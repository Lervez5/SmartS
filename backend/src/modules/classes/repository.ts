import { PrismaClient } from "@prisma/client";
import { CreateClassDto, UpdateClassDto } from "./types";

const prisma = new PrismaClient();

export async function findClassesByTeacher(teacherId: string) {
  return prisma.class.findMany({
    where: { teacherId },
    include: {
      subject: true,
      // @ts-ignore
      course: {
        include: {
          _count: {
            select: { modules: true }
          }
        }
      },
      _count: {
        select: { enrollments: true }
      }
    }
  });
}

export async function findAllClasses() {
  return prisma.class.findMany({
    include: {
      teacher: {
        select: { id: true, name: true, avatar: true }
      },
      subject: true,
      // @ts-ignore
      course: {
        include: {
          _count: {
            select: { modules: true }
          }
        }
      },
      _count: {
        select: { enrollments: true }
      }
    }
  });
}

export async function findClassById(id: string) {
  return prisma.class.findUnique({
    where: { id },
    include: {
      teacher: {
        select: { id: true, name: true, avatar: true }
      },
      subject: true,
      // @ts-ignore
      course: {
        include: {
          modules: {
            orderBy: { order: 'asc' },
            include: {
              units: {
                orderBy: { order: 'asc' },
                include: {
                  lessons: true
                }
              }
            }
          }
        }
      },
      enrollments: {
        include: {
          student: {
            select: { id: true, name: true, avatar: true }
          }
        }
      }
    }
  });
}

export async function createClass(data: CreateClassDto) {
  return prisma.class.create({
    data: {
      ...data,
      schedule: new Date()
    }
  });
}

export async function updateClass(id: string, data: UpdateClassDto) {
  return prisma.class.update({
    where: { id },
    data
  });
}

export async function enrollBulkStudents(classId: string, emails: string[]) {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true }
  });

  const existingEmails = users.map(u => u.email);
  const missingEmails = emails.filter(e => !existingEmails.includes(e));

  const cohort = await prisma.class.findUnique({
    where: { id: classId },
    // @ts-ignore
    select: { courseId: true }
  });

  await Promise.all(users.map(async (user) => {
    const existing = await prisma.enrollment.findFirst({
      where: { classId, studentId: user.id }
    });
    if (!existing) {
      await prisma.enrollment.create({ data: { classId, studentId: user.id } });
    }

    // @ts-ignore
    if (cohort?.courseId) {
      const courseExisting = await prisma.courseEnrollment.findFirst({
        // @ts-ignore
        where: { courseId: cohort.courseId, studentId: user.id }
      });
      if (!courseExisting) {
        await prisma.courseEnrollment.create({
          // @ts-ignore
          data: { courseId: cohort.courseId, studentId: user.id }
        });
      }
    }
  }));

  return {
    enrolledCount: users.length,
    invitedCount: missingEmails.length,
    invitedEmails: missingEmails
  };
}
