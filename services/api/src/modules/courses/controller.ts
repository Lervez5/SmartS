import { Request, Response } from 'express';
import {
  createCourseSchema,
  updateCourseSchema,
  createClassSchema,
  classScheduleSchema,
} from './schema';
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
  // Students only ever see published material.
  if (req.user!.role === 'STUDENT') {
    const enrollments = await getStudentCourses(req.user!.id);
    res.json(enrollments.map((e) => e.course));
    return;
  }
  const courses = await listCourses(req.user!.role === 'TEACHER' ? req.user!.id : undefined);
  res.json(courses);
}

export async function getCourseController(req: Request, res: Response): Promise<void> {
  res.json(await getCourse(req.params.id));
}

export async function createCourseController(req: Request, res: Response): Promise<void> {
  const dto = createCourseSchema.parse(req.body);
  const course = await createCourse({
    ...dto,
    teacherId: dto.teacherId ?? (req.user!.role === 'TEACHER' ? req.user!.id : undefined),
  });
  res.status(201).json(course);
}

export async function updateCourseController(req: Request, res: Response): Promise<void> {
  const dto = updateCourseSchema.parse(req.body);
  res.json(await updateCourse(req.params.id, dto));
}

export async function deleteCourseController(req: Request, res: Response): Promise<void> {
  await deleteCourse(req.params.id);
  res.json({ message: 'Course deleted' });
}

export async function myCoursesController(req: Request, res: Response): Promise<void> {
  res.json(await getStudentCourses(req.user!.id));
}

export async function completeLessonController(req: Request, res: Response): Promise<void> {
  const result = await completeLesson(req.user!.id, req.params.id, req.params.lessonId);
  res.json(result);
}

export async function listClassesController(req: Request, res: Response): Promise<void> {
  res.json(
    await listClasses({
      teacherId: req.user!.role === 'TEACHER' ? req.user!.id : undefined,
      courseId: req.query.courseId ? String(req.query.courseId) : undefined,
    })
  );
}

export async function getClassController(req: Request, res: Response): Promise<void> {
  res.json(await getClass(req.params.id));
}

export async function createClassController(req: Request, res: Response): Promise<void> {
  const dto = createClassSchema.parse(req.body);
  res.status(201).json(await createClass(dto));
}

export async function addScheduleController(req: Request, res: Response): Promise<void> {
  const dto = classScheduleSchema.parse(req.body);
  res.status(201).json(await addClassSchedule(req.params.id, dto));
}

export async function removeScheduleController(req: Request, res: Response): Promise<void> {
  await removeClassSchedule(req.params.scheduleId);
  res.json({ message: 'Schedule removed' });
}
