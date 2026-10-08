import { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database";

/**
 * A cohort is a Class in the data model, surfaced under the naming the school
 * UI uses: student counts live under `_count.students` and the start date is
 * the first class schedule's validFrom (falling back to the class schedule).
 */
const cohortSelect = {
  id: true,
  name: true,
  description: true,
  classCode: true,
  gradeLevel: true,
  schedule: true,
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, email: true } },
  course: { select: { id: true, title: true } },
  schedules: { select: { id: true, dayOfWeek: true, startTime: true, endTime: true, room: true } },
  _count: { select: { enrollments: true } },
} satisfies Prisma.ClassSelect;

type CohortRow = {
  id: string;
  name: string;
  description: string | null;
  classCode: string | null;
  gradeLevel: string | null;
  schedule: Date | null;
  subject: { id: string; name: string } | null;
  teacher: { id: string; name: string | null; email: string } | null;
  course: { id: string; title: string } | null;
  schedules: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; room: string | null }>;
  _count: { enrollments: number };
};

function present(row: CohortRow) {
  return {
    ...row,
    // Aliases the UI expects.
    _count: { students: row._count.enrollments, enrollments: row._count.enrollments },
    startDate: row.schedule ?? null,
    timetable: row.schedules,
  };
}

export async function listCohorts(options: { teacherId?: string } = {}) {
  const rows = await prisma.class.findMany({
    where: options.teacherId ? { teacherId: options.teacherId } : undefined,
    select: cohortSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(present);
}

export async function getCohort(id: string) {
  const row = await prisma.class.findUnique({
    where: { id },
    select: {
      ...cohortSelect,
      enrollments: {
        select: {
          id: true,
          student: { select: { id: true, name: true, email: true, avatar: true } },
        },
      },
    },
  });
  if (!row) throw new Error("Cohort not found.");

  const { enrollments, ...base } = row;
  return {
    ...present(base as CohortRow),
    students: enrollments.map((e) => e.student),
    enrollments,
  };
}

export async function createCohort(dto: {
  name: string;
  description?: string;
  classCode?: string;
  gradeLevel?: string;
  subjectId?: string;
  courseId?: string;
  teacherId?: string;
  schedule?: string;
}) {
  const row = await prisma.class.create({
    data: {
      name: dto.name,
      description: dto.description,
      classCode: dto.classCode,
      gradeLevel: dto.gradeLevel,
      subjectId: dto.subjectId,
      courseId: dto.courseId,
      teacherId: dto.teacherId,
      schedule: dto.schedule ? new Date(dto.schedule) : null,
    },
    select: cohortSelect,
  });
  return present(row);
}

export async function updateCohort(
  id: string,
  dto: {
    name?: string;
    description?: string;
    classCode?: string;
    gradeLevel?: string;
    subjectId?: string;
    courseId?: string;
    teacherId?: string;
    schedule?: string;
  }
) {
  const existing = await prisma.class.findUnique({ where: { id } });
  if (!existing) throw new Error("Cohort not found.");

  const row = await prisma.class.update({
    where: { id },
    data: {
      name: dto.name,
      description: dto.description,
      classCode: dto.classCode,
      gradeLevel: dto.gradeLevel,
      subjectId: dto.subjectId,
      courseId: dto.courseId,
      teacherId: dto.teacherId,
      schedule: dto.schedule ? new Date(dto.schedule) : undefined,
    },
    select: cohortSelect,
  });
  return present(row);
}

export async function deleteCohort(id: string) {
  const existing = await prisma.class.findUnique({ where: { id } });
  if (!existing) throw new Error("Cohort not found.");
  await prisma.class.delete({ where: { id } });
}

/** Enrol a student into a cohort. */
export async function addStudent(cohortId: string, studentId: string) {
  const cls = await prisma.class.findUnique({ where: { id: cohortId } });
  if (!cls) throw new Error("Cohort not found.");
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) throw new Error("Student not found.");

  return prisma.enrollment.upsert({
    where: { studentId_classId: { studentId, classId: cohortId } },
    update: {},
    create: { studentId, classId: cohortId },
  });
}

export async function removeStudent(cohortId: string, studentId: string) {
  const existing = await prisma.enrollment.findUnique({
    where: { studentId_classId: { studentId, classId: cohortId } },
  });
  if (!existing) throw new Error("Student is not enrolled in this cohort.");
  return prisma.enrollment.delete({ where: { id: existing.id } });
}
