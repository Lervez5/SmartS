export interface Course {
  id: string;
  title: string;
  description?: string;
  category?: string;
  learningObjectives: string[];
  status: "draft" | "published" | "locked";
  teacherId: string;
  subjectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonInput {
  id?: string;
  title: string;
  lessonType: string;
  content: string;
  subjectId: string;
}

export interface UnitInput {
  id?: string;
  title: string;
  description?: string;
  lessons: LessonInput[];
}

export interface ModuleInput {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  units: UnitInput[];
}

export interface CreateCourseDto {
  title: string;
  description?: string;
  category?: string;
  learningObjectives: string[];
  teacherId: string;
  subjectId: string;
  status?: "draft" | "published" | "locked";
  modules?: ModuleInput[];
}

export interface UpdateCourseDto {
  title?: string;
  description?: string;
  category?: string;
  learningObjectives?: string[];
  status?: "draft" | "published" | "locked";
  modules?: ModuleInput[];
}

export interface CourseEnrollment {
  id: string;
  studentId: string;
  courseId: string;
  progress: number;
  status: "active" | "completed" | "dropped";
}
