import * as repository from './repository';
import { CreateCourseDto, UpdateCourseDto } from './types';
import { ApiError } from '../../shared/errorHandler';
import { logAction } from '../audit-logs/service';

export async function getAllCourses(filters?: { status?: string, category?: string }) {
  return repository.findAllCourses(filters);
}

export async function getCourseDetails(id: string) {
  const course = await repository.findCourseById(id);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }
  return course;
}

export async function createNewCourse(data: CreateCourseDto) {
  const course = await repository.createCourse(data);
  await logAction(data.teacherId, 'COURSE_CREATE', `Created course: ${course.title} (${course.id})`);
  return course;
}

export async function updateCourseInfo(id: string, data: UpdateCourseDto, userId: string) {
  const existing = await getCourseDetails(id); 
  const course = await repository.updateCourse(id, data);
  if (!course) throw new ApiError(500, "Failed to update course");
  await logAction(userId, 'COURSE_UPDATE', `Updated course: ${course.title} (${course.id})`);
  return course;
}

export async function removeCourse(id: string) {
  await getCourseDetails(id);
  return repository.deleteCourse(id);
}

export async function getStudentCourses(studentId: string) {
  return repository.getStudentEnrollments(studentId);
}

export async function completeLesson(studentId: string, courseId: string, lessonId: string) {
    const enrollment = await repository.findEnrollment(studentId, courseId);
    if (!enrollment) throw new ApiError(404, "Enrollment not found");

    const course = await repository.findCourseById(courseId);
    if (!course) throw new ApiError(404, "Course not found");

    // Calculate total lessons across all modules and units
    let totalLessons = 0;
    // @ts-ignore
    (course.modules || []).forEach((m: any) => {
        // @ts-ignore
        (m.units || []).forEach((u: any) => {
            totalLessons += u.lessons?.length || 0;
        });
    });

    const increment = totalLessons > 0 ? Math.round(100 / totalLessons) : 0;
    const newProgress = Math.min(enrollment.progress + increment, 100);

    return repository.updateEnrollmentProgress(enrollment.id, newProgress);
}

export async function toggleModuleLock(moduleId: string) {
    const module = await repository.findModuleById(moduleId);
    if (!module) throw new ApiError(404, "Module not found");

    return repository.updateModuleLock(moduleId, !module.isLocked);
}
