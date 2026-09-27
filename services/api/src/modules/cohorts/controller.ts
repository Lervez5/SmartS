import { Request, Response } from "express";
import {
  createCohortSchema,
  updateCohortSchema,
  addStudentSchema,
} from "./schema";
import {
  listCohorts,
  getCohort,
  createCohort,
  updateCohort,
  deleteCohort,
  addStudent,
  removeStudent,
} from "./service";

export async function listCohortsController(req: Request, res: Response): Promise<void> {
  res.json(await listCohorts({ teacherId: req.query.mine === "1" ? req.user!.id : undefined }));
}

export async function getCohortController(req: Request, res: Response): Promise<void> {
  res.json(await getCohort(req.params.id));
}

export async function createCohortController(req: Request, res: Response): Promise<void> {
  const dto = createCohortSchema.parse(req.body);
  res.status(201).json(await createCohort(dto));
}

export async function updateCohortController(req: Request, res: Response): Promise<void> {
  const dto = updateCohortSchema.parse(req.body);
  res.json(await updateCohort(req.params.id, dto));
}

export async function deleteCohortController(req: Request, res: Response): Promise<void> {
  await deleteCohort(req.params.id);
  res.json({ message: "Cohort deleted" });
}

export async function addStudentController(req: Request, res: Response): Promise<void> {
  const { studentId } = addStudentSchema.parse(req.body);
  res.status(201).json(await addStudent(req.params.id, studentId));
}

export async function removeStudentController(req: Request, res: Response): Promise<void> {
  await removeStudent(req.params.id, req.params.studentId);
  res.json({ message: "Student removed from cohort" });
}
