import {
  createExercise,
  createLesson,
  createSubject,
  createTopic,
  listExercisesByLesson,
  listLessonsBySubject,
  listSubjects,
  listTopics,
} from "./repository";
import {
  CreateExerciseInput,
  CreateLessonInput,
  CreateSubjectInput,
  CreateTopicInput,
} from "./schema";

export function listSubjectsService() {
  return listSubjects();
}

export function createSubjectService(input: CreateSubjectInput) {
  return createSubject(input.name);
}

export function createTopicService(input: CreateTopicInput) {
  return createTopic(input.subjectId, input.name);
}

export function listTopicsService(subjectId: string) {
  return listTopics(subjectId);
}

export function createLessonService(input: CreateLessonInput) {
  return createLesson({
    subjectId: input.subjectId,
    topicId: input.topicId,
    title: input.title,
    content: input.content,
  });
}

export function listLessonsBySubjectService(subjectId: string) {
  return listLessonsBySubject(subjectId);
}

export function createExerciseService(input: CreateExerciseInput) {
  return createExercise({
    lessonId: input.lessonId,
    prompt: input.prompt,
    difficulty: input.difficulty,
    maxScore: input.maxScore,
  });
}

export function listExercisesByLessonService(lessonId: string) {
  return listExercisesByLesson(lessonId);
}


