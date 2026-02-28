import { Router } from "express";
import {
  createExerciseController,
  createLessonController,
  createSubjectController,
  createTopicController,
  listExercisesByLessonController,
  listLessonsBySubjectController,
  listSubjectsController,
  listTopicsController,
} from "./controller";

export const router = Router();

router.get("/", (req, res, next) => {
  listSubjectsController(req, res).catch(next);
});

router.post("/", (req, res, next) => {
  createSubjectController(req, res).catch(next);
});

router.get("/:subjectId/topics", (req, res, next) => {
  listTopicsController(req, res).catch(next);
});

router.post("/topics", (req, res, next) => {
  createTopicController(req, res).catch(next);
});

router.get("/:subjectId/lessons", (req, res, next) => {
  listLessonsBySubjectController(req, res).catch(next);
});

router.post("/lessons", (req, res, next) => {
  createLessonController(req, res).catch(next);
});

router.get("/lessons/:lessonId/exercises", (req, res, next) => {
  listExercisesByLessonController(req, res).catch(next);
});

router.post("/exercises", (req, res, next) => {
  createExerciseController(req, res).catch(next);
});


