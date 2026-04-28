export interface Class {
  id: string;
  name: string;
  description?: string;
  teacherId: string;
  subjectId: string;
  courseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClassDto {
  name: string;
  description?: string;
  teacherId: string;
  subjectId: string;
  courseId?: string;
}

export interface UpdateClassDto {
  name?: string;
  description?: string;
  courseId?: string;
}
