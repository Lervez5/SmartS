import * as repository from './repository';
import { CreateClassDto, UpdateClassDto } from './types';
import { ApiError } from '../../shared/errorHandler';

export async function getTeacherCohorts(teacherId: string) {
  return repository.findClassesByTeacher(teacherId);
}

export async function getAllCohorts() {
  return repository.findAllClasses();
}

export async function getCohortDetails(id: string) {
  const cohort = await repository.findClassById(id);
  if (!cohort) {
    throw new ApiError(404, 'Cohort not found');
  }
  return cohort;
}

export async function enrollBulkStudents(cohortId: string, emails: string[]) {
  return repository.enrollBulkStudents(cohortId, emails);
}

export async function createNewCohort(data: CreateClassDto) {
  return repository.createClass(data);
}

export async function updateCohortInfo(id: string, data: UpdateClassDto) {
  return repository.updateClass(id, data);
}
