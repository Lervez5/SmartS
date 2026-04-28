import { Request, Response, NextFunction } from 'express';
import * as service from './service';

export async function getAllCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const filters = req.query as any;
    const courses = await service.getAllCourses(filters);
    res.json(courses);
  } catch (error) {
    next(error);
  }
}

export async function getCourseById(req: Request, res: Response, next: NextFunction) {
  try {
    const course = await service.getCourseDetails(req.params.id);
    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function createCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const course = await service.createNewCourse(req.body);
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
}

export async function updateCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user.id;
    const course = await service.updateCourseInfo(req.params.id, req.body, userId);
    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function deleteCourse(req: Request, res: Response, next: NextFunction) {
  try {
    await service.removeCourse(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function getStudentEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as any).user?.id;
        if (!userId) throw new Error("Unauthorized");
        const enrollments = await service.getStudentCourses(userId);
        res.json(enrollments);
    } catch (error) {
        next(error);
    }
}

export async function completeLesson(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = (req as any).user?.id;
        const { id: courseId, lessonId } = req.params;
        if (!userId) throw new Error("Unauthorized");
        const enrollment = await service.completeLesson(userId, courseId, lessonId);
        res.json(enrollment);
    } catch (error) {
        next(error);
    }
}

export async function toggleModuleLock(req: Request, res: Response, next: NextFunction) {
    try {
        const moduleId = req.params.moduleId;
        const module = await service.toggleModuleLock(moduleId);
        res.json(module);
    } catch (error) {
        next(error);
    }
}
