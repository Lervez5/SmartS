import { Request, Response } from "express";
import {
  createExerciseSchema,
  createLessonSchema,
  createSubjectSchema,
  createTopicSchema,
} from "./schema";
import {
  createExerciseService,
  createLessonService,
  createSubjectService,
  createTopicService,
  listExercisesByLessonService,
  listLessonsBySubjectService,
  listSubjectsService,
  listTopicsService,
} from "./service";
import { ApiError } from "../../shared/errorHandler";

function requireAdmin(req: Request) {
  if (!req.user || req.user.role !== "admin") {
    throw new ApiError(403, "Admin role required");
  }
}

export async function listSubjectsController(_req: Request, res: Response) {
  const subjects = await listSubjectsService();
  res.json({ subjects });
}

export async function createSubjectController(req: Request, res: Response) {
  requireAdmin(req);
  const parsed = createSubjectSchema.parse(req.body);
  const subject = await createSubjectService(parsed);
  res.status(201).json({ subject });
}

export async function createTopicController(req: Request, res: Response) {
  requireAdmin(req);
  const parsed = createTopicSchema.parse(req.body);
  const topic = await createTopicService(parsed);
  res.status(201).json({ topic });
}

export async function listTopicsController(req: Request, res: Response) {
  const topics = await listTopicsService(req.params.subjectId);
  res.json({ topics });
}

export async function createLessonController(req: Request, res: Response) {
  requireAdmin(req);
  const parsed = createLessonSchema.parse(req.body);
  const lesson = await createLessonService(parsed);
  res.status(201).json({ lesson });
}

export async function listLessonsBySubjectController(req: Request, res: Response) {
  const lessons = await listLessonsBySubjectService(req.params.subjectId);
  res.json({ lessons });
}

export async function createExerciseController(req: Request, res: Response) {
  requireAdmin(req);
  const parsed = createExerciseSchema.parse(req.body);
  const exercise = await createExerciseService(parsed);
  res.status(201).json({ exercise });
}

export async function listExercisesByLessonController(req: Request, res: Response) {
  const exercises = await listExercisesByLessonService(req.params.lessonId);
  res.json({ exercises });
}


