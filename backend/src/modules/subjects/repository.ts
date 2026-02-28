import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export function listSubjects() {
  return prisma.subject.findMany({ orderBy: { name: "asc" } });
}

export function createSubject(name: string) {
  return prisma.subject.create({ data: { name } });
}

export function createTopic(subjectId: string, name: string) {
  return prisma.topic.create({ data: { subjectId, name } });
}

export function listTopics(subjectId: string) {
  return prisma.topic.findMany({ where: { subjectId }, orderBy: { name: "asc" } });
}

export function createLesson(data: {
  subjectId: string;
  topicId?: string | null;
  title: string;
  content: string;
}) {
  return prisma.lesson.create({ data });
}

export function listLessonsBySubject(subjectId: string) {
  return prisma.lesson.findMany({ where: { subjectId }, orderBy: { title: "asc" } });
}

export function createExercise(data: {
  lessonId: string;
  prompt: string;
  difficulty: number;
  maxScore: number;
}) {
  return prisma.exercise.create({ data });
}

export function listExercisesByLesson(lessonId: string) {
  return prisma.exercise.findMany({ where: { lessonId } });
}


