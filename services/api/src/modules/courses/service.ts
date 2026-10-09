import { CourseStatus, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { CreateCourseDto, UpdateCourseDto, CreateClassDto, ClassScheduleDto } from './schema';
import { ApiError } from '../../shared/logger';
import { recordAuditLog } from '../audit-logs/service';

const courseInclude = {
  subject: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true, email: true } },
  _count: { select: { enrollments: true, modules: true, classes: true } },
} satisfies Prisma.CourseInclude;

/**
 * Courses for one school.
 *
 * `schoolId` is required on every read and write below. A course belongs to one
 * school, so without the filter a school would list and edit every other
 * school's courses - and, before the course carried a school at all, the scope
 * could only be guessed from its subject or classes.
 */
export async function listCourses(schoolId: string, teacherId?: string) {
  return prisma.course.findMany({
    where: { schoolId, ...(teacherId ? { teacherId } : {}) },
    include: courseInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCourse(schoolId: string, id: string) {
  // Scoped, so a course from another school reads as "not found" rather than
  // confirming it exists.
  const course = await prisma.course.findFirst({
    where: { id, schoolId },
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
  if (!course) throw new ApiError(404, 'Course not found.');
  return course;
}

export async function createCourse(schoolId: string, dto: CreateCourseDto) {
  // A course's learning area must be the caller's own, so attaching a subject
  // from another school is refused rather than written and read back as though
  // it belonged here.
  if (dto.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: dto.subjectId, schoolId },
      select: { id: true },
    });
    if (!subject) {
      throw new ApiError(404, 'That learning area does not exist in your school.');
    }
  }

  return prisma.course.create({
    data: {
      schoolId,
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

export async function updateCourse(schoolId: string, id: string, dto: UpdateCourseDto) {
  // The whole update is scoped: a course belonging to another school fails here
  // rather than being found and edited.
  const existing = await prisma.course.findFirst({ where: { id, schoolId } });
  if (!existing) throw new ApiError(404, 'Course not found.');

  if (dto.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: dto.subjectId, schoolId },
      select: { id: true },
    });
    if (!subject) {
      throw new ApiError(404, 'That learning area does not exist in your school.');
    }
  }

  return prisma.course.update({
    where: { id: existing.id },
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

export async function deleteCourse(schoolId: string, id: string) {
  const existing = await prisma.course.findFirst({
    where: { id, schoolId },
    include: { _count: { select: { enrollments: true, classes: true, modules: true } } },
  });
  if (!existing) throw new ApiError(404, 'Course not found.');

  // Modules, units, lessons, enrolment and progress all hang off the course.
  // Deleting it takes the learner's progress with it, so a course anyone has
  // started is retired instead.
  if (existing._count.enrollments > 0 || existing._count.modules > 0) {
    throw new ApiError(
      409,
      `This course has ${existing._count.enrollments} enrolment(s) and ${existing._count.modules} module(s). ` +
        'Archive it rather than deleting it, so learner progress is kept.'
    );
  }

  await prisma.course.delete({ where: { id: existing.id } });
}

/** Courses a student is enrolled in, with progress. */
export async function getStudentCourses(schoolId: string, studentId: string) {
  const enrollments = await prisma.courseEnrollment.findMany({
    // Scoped through the course, so a learner only ever sees their own school's
    // courses even though their enrolment spans every school they belong to.
    where: { studentId, course: { schoolId } },
    include: {
      course: { include: courseInclude },
    },
    orderBy: { createdAt: 'desc' },
  });
  return enrollments;
}

export async function completeLesson(
  schoolId: string,
  userId: string,
  courseId: string,
  lessonId: string
) {
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, unit: { module: { courseId, course: { schoolId } } } },
  });
  if (!lesson) throw new ApiError(404, 'Lesson not found.');

  const access = await prisma.lessonAccessLog.create({
    data: { lessonId, studentId: userId },
  });

  await recordAuditLog(userId, 'COMPLETE_LESSON', `Completed lesson ${lesson.title}`);

  const total = await prisma.lesson.count({
    where: { unit: { module: { courseId, course: { schoolId } } } },
  });
  const done = await prisma.lessonAccessLog.count({
    where: { studentId: userId, lesson: { unit: { module: { courseId, course: { schoolId } } } } },
  });
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  await prisma.courseEnrollment.updateMany({
    where: { studentId: userId, courseId, course: { schoolId } },
    data: { progress: percent },
  });

  return { access, progress: percent, completed: done, total };
}

export async function listClasses(
  schoolId: string,
  filters: { teacherId?: string; courseId?: string } = {}
) {
  return prisma.class.findMany({
    where: {
      schoolId,
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

export async function getClass(schoolId: string, id: string) {
  const cls = await prisma.class.findFirst({
    where: { id, schoolId },
    include: {
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, email: true } },
      schedules: true,
      enrollments: {
        include: { student: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!cls) throw new ApiError(404, 'Class not found.');
  return cls;
}

export async function createClass(dto: CreateClassDto, schoolId: string) {
  // A class's home learning area has to be one of the caller's own, so a
  // subject id from another school is refused here rather than written and then
  // read back as though it belonged to this school.
  if (dto.subjectId) {
    const subject = await prisma.subject.findFirst({
      where: { id: dto.subjectId, schoolId },
      select: { id: true },
    });
    if (!subject) {
      throw new ApiError(404, 'That learning area does not exist in your school.');
    }
  }

  return prisma.class.create({
    data: {
      schoolId,
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

export async function addClassSchedule(schoolId: string, classId: string, dto: ClassScheduleDto) {
  const cls = await prisma.class.findFirst({ where: { id: classId, schoolId } });
  if (!cls) throw new ApiError(404, 'Class not found.');
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

export async function removeClassSchedule(schoolId: string, scheduleId: string) {
  // Scoped through the class the schedule hangs off, so one school cannot
  // remove another's timetable entry.
  const schedule = await prisma.classSchedule.findFirst({
    where: { id: scheduleId, class: { schoolId } },
    select: { id: true },
  });
  if (!schedule) throw new ApiError(404, 'Schedule not found.');
  return prisma.classSchedule.delete({ where: { id: scheduleId } });
}
