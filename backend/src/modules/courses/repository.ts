import { PrismaClient } from "@prisma/client";
import { CreateCourseDto, UpdateCourseDto } from "./types";

const prisma = new PrismaClient();

export async function findAllCourses() {
  return prisma.course.findMany({
    include: {
      teacher: {
        select: { id: true, name: true }
      },
      school: {
        select: { id: true, name: true }
      }
    }
  });
}

export async function findCourseById(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      teacher: {
        select: { id: true, name: true }
      },
      lessons: true
    }
  });
}

export async function createCourse(data: CreateCourseDto) {
  return prisma.course.create({
    data
  });
}

export async function updateCourse(id: string, data: UpdateCourseDto) {
  return prisma.course.update({
    where: { id },
    data
  });
}

export async function deleteCourse(id: string) {
  return prisma.course.delete({
    where: { id }
  });
}
