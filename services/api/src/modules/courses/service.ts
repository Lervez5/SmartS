import { CourseStatus, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { CreateCourseDto, UpdateCourseDto, CreateClassDto, ClassScheduleDto } from './schema';
import { recordAuditLog } from '../audit-logs/service';

const courseInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, email: true } },
  _count: { select: { enrollments: true, modules: true, classes: true } },
} satisfies Prisma.CourseInclude;

export async function listCourses(teacherId?: string) {
  return prisma.course.findMany({
    where: teacherId ? { teacherId } : undefined,
    include: courseInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCourse(id: string) {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, email: true } },
      _count: { select: { enrollments: true, modules: true, classes: true } },
      modules: {
        orderBy: { order: 'asc' },
        include: {
          units: {
            orderBy: { order: 'asc' },
            include: { lessons: { orderBy: { createdAt: 'asc' } } },
          },
        },
      },
    },
  });
  if (!course) throw new Error('Course not found.');
  return course;
}

export async function createCourse(dto: CreateCourseDto) {
  return prisma.course.create({
    data: {
      title: dto.title,
      description: dto.description,
      code: dto.code,
      category: dto.category,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId,
      learningObjectives: dto.learningObjectives ?? [],
      status: CourseStatus.draft,
    },
    include: courseInclude,
  });
}

export async function updateCourse(id: string, dto: UpdateCourseDto) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw new Error('Course not found.');
  return prisma.course.update({
    where: { id },
    data: {
      title: dto.title,
      description: dto.description,
      code: dto.code,
      category: dto.category,
      subjectId: dto.subjectId,
      teacherId: dto.teacherId,
      learningObjectives: dto.learningObjectives,
      ...(dto.status ? { status: dto.status as CourseStatus } : {}),
    },
    include: courseInclude,
  });
}

export async function deleteCourse(id: string) {
  const existing = await prisma.course.findUnique({ where: { id } });
  if (!existing) throw new Error('Course not found.');
  await prisma.course.delete({ where: { id } });
}

/** Courses a student is enrolled in, with progress. */
export async function getStudentCourses(studentId: string) {
  const enrollments = await prisma.courseEnrollment.findMany({
    where: { studentId },
    include: {
      course: { include: courseInclude },
    },
    orderBy: { createdAt: 'desc' },
  });
  return enrollments;
}

export async function completeLesson(userId: string, courseId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) throw new Error('Lesson not found.');

  const access = await prisma.lessonAccessLog.create({
    data: { lessonId, studentId: userId },
  });

  await recordAuditLog(userId, 'COMPLETE_LESSON', `Completed lesson ${lesson.title}`);

  const total = await prisma.lesson.count({
    where: { unit: { module: { courseId } } },
  });
  const done = await prisma.lessonAccessLog.count({
    where: { studentId: userId, lesson: { unit: { module: { courseId } } } },
  });
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  await prisma.courseEnrollment.updateMany({
    where: { studentId: userId, courseId },
    data: { progress: percent },
  });

  return { access, progress: percent, completed: done, total };
}

export async function listClasses(filters: { teacherId?: string; courseId?: string } = {}) {
  return prisma.class.findMany({
    where: {
      ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
      ...(filters.courseId ? { courseId: filters.courseId } : {}),
    },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, email: true } },
      schedules: true,
      _count: { select: { enrollments: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getClass(id: string) {
  const cls = await prisma.class.findUnique({
    where: { id },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, email: true } },
      schedules: true,
      enrollments: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!cls) throw new Error('Class not found.');
  return cls;
}

export async function createClass(dto: CreateClassDto) {
  return prisma.class.create({
    data: {
      name: dto.name,
      description: dto.description,
      classCode: dto.classCode,
      gradeLevel: dto.gradeLevel,
      subjectId: dto.subjectId,
      courseId: dto.courseId,
      teacherId: dto.teacherId,
    },
    include: { subject: true, schedules: true },
  });
}

export async function addClassSchedule(classId: string, dto: ClassScheduleDto) {
  const cls = await prisma.class.findUnique({ where: { id: classId } });
  if (!cls) throw new Error('Class not found.');
  return prisma.classSchedule.create({
    data: {
      classId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      room: dto.room,
      recurrence: dto.recurrence ?? 'weekly',
      validFrom: new Date(dto.validFrom),
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    },
  });
}

export async function removeClassSchedule(scheduleId: string) {
  return prisma.classSchedule.delete({ where: { id: scheduleId } });
}
