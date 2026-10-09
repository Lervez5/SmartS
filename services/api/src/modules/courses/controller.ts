import { Request, Response } from 'express';
import {
  createCourseSchema,
  updateCourseSchema,
  createClassSchema,
  classScheduleSchema,
} from './schema';
import { schoolScopeOf } from '../settings/scope';
import {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  getStudentCourses,
  completeLesson,
  listClasses,
  getClass,
  createClass,
  addClassSchedule,
  removeClassSchedule,
} from './service';

export async function listCoursesController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);

  // Students only ever see published material, and only their own school's.
  if (req.user!.role === 'STUDENT') {
    const enrollments = await getStudentCourses(schoolId, req.user!.id);
    res.json(enrollments.map((e) => e.course));
    return;
  }
  const courses = await listCourses(
    schoolId,
    req.user!.role === 'TEACHER' ? req.user!.id : undefined
  );
  res.json(courses);
}

export async function getCourseController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(await getCourse(schoolId, req.params.id));
}

export async function createCourseController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  const dto = createCourseSchema.parse(req.body);
  const course = await createCourse(schoolId, {
    ...dto,
    teacherId: dto.teacherId ?? (req.user!.role === 'TEACHER' ? req.user!.id : undefined),
  });
  res.status(201).json(course);
}

export async function updateCourseController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  const dto = updateCourseSchema.parse(req.body);
  res.json(await updateCourse(schoolId, req.params.id, dto));
}

export async function deleteCourseController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  await deleteCourse(schoolId, req.params.id);
  res.json({ message: 'Course deleted' });
}

export async function myCoursesController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(await getStudentCourses(schoolId, req.user!.id));
}

export async function completeLessonController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  const result = await completeLesson(schoolId, req.user!.id, req.params.id, req.params.lessonId);
  res.json(result);
}

export async function listClassesController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(
    await listClasses(schoolId, {
      teacherId: req.user!.role === 'TEACHER' ? req.user!.id : undefined,
      courseId: req.query.courseId ? String(req.query.courseId) : undefined,
    })
  );
}

export async function getClassController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  res.json(await getClass(schoolId, req.params.id));
}

export async function createClassController(req: Request, res: Response): Promise<void> {
  const dto = createClassSchema.parse(req.body);
  res.status(201).json(await createClass(dto, schoolScopeOf(req).schoolId));
}

export async function addScheduleController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  const dto = classScheduleSchema.parse(req.body);
  res.status(201).json(await addClassSchedule(schoolId, req.params.id, dto));
}

export async function removeScheduleController(req: Request, res: Response): Promise<void> {
  const { schoolId } = schoolScopeOf(req);
  await removeClassSchedule(schoolId, req.params.scheduleId);
  res.json({ message: 'Schedule removed' });
}
