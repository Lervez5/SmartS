export interface Course {
  id: string;
  title: string;
  description?: string;
  teacherId: string;
  schoolId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseDto {
  title: string;
  description?: string;
  teacherId: string;
  schoolId: string;
}

export interface UpdateCourseDto {
  title?: string;
  description?: string;
  teacherId?: string;
}
