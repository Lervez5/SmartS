import { Request, Response, NextFunction } from 'express';
import * as service from './service';

export async function getTeacherCohorts(req: Request, res: Response, next: NextFunction) {
  try {
    const teacherId = (req as any).user.id;
    const cohorts = await service.getTeacherCohorts(teacherId);
    res.json(cohorts);
  } catch (error) {
    next(error);
  }
}

export async function getAllCohorts(req: Request, res: Response, next: NextFunction) {
  try {
    const cohorts = await service.getAllCohorts();
    res.json(cohorts);
  } catch (error) {
    next(error);
  }
}

export async function getCohortById(req: Request, res: Response, next: NextFunction) {
  try {
    const cohort = await service.getCohortDetails(req.params.id);
    res.json(cohort);
  } catch (error) {
    next(error);
  }
}

export async function enrollBulkStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const { emails } = req.body;
    const result = await service.enrollBulkStudents(req.params.id, emails);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function createCohort(req: Request, res: Response, next: NextFunction) {
  try {
    const cohort = await service.createNewCohort(req.body);
    res.status(201).json(cohort);
  } catch (error) {
    next(error);
  }
}

export async function updateCohort(req: Request, res: Response, next: NextFunction) {
  try {
    const cohort = await service.updateCohortInfo(req.params.id, req.body);
    res.json(cohort);
  } catch (error) {
    next(error);
  }
}
