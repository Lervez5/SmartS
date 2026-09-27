export interface Course {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  status: CourseStatus;
  subjectId?: string | null;
  teacherId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CourseStatus = "draft" | "active" | "archived";

export interface Module {
  id: string;
  courseId: string;
  course?: Course;
  title: string;
  description?: string | null;
  order: number;
  createdAt: Date;
}

export interface Unit {
  id: string;
  moduleId: string;
  module?: Module;
  title: string;
  description?: string | null;
  order: number;
  createdAt: Date;
}

export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  course?: Course;
  enrolledAt: Date;
}
