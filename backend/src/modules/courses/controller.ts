import { Request, Response, NextFunction } from 'express';
import * as service from './service';

export async function getAllCourses(req: Request, res: Response, next: NextFunction) {
  try {
    const courses = await service.getAllCourses();
    res.json(courses);
  } catch (error) {
    next(error);
  }
}

export async function getCourseById(req: Request, res: Response, next: NextFunction) {
  try {
    const course = await service.getCourseById(req.params.id);
    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function createCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const course = await service.createCourse(req.body);
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
}

export async function updateCourse(req: Request, res: Response, next: NextFunction) {
  try {
    const course = await service.updateCourse(req.params.id, req.body);
    res.json(course);
  } catch (error) {
    next(error);
  }
}

export async function deleteCourse(req: Request, res: Response, next: NextFunction) {
  try {
    await service.deleteCourse(req.params.id);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
