import * as repository from './repository';
import { CreateCourseDto, UpdateCourseDto } from './types';
import { ApiError } from '../../shared/errorHandler';

export async function getAllCourses() {
  return repository.findAllCourses();
}

export async function getCourseById(id: string) {
  const course = await repository.findCourseById(id);
  if (!course) {
    throw new ApiError(404, 'Course not found');
  }
  return course;
}

export async function createCourse(data: CreateCourseDto) {
  return repository.createCourse(data);
}

export async function updateCourse(id: string, data: UpdateCourseDto) {
  await getCourseById(id); // Ensure exists
  return repository.updateCourse(id, data);
}

export async function deleteCourse(id: string) {
  await getCourseById(id); // Ensure exists
  return repository.deleteCourse(id);
}
