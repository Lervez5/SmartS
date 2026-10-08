export interface Subject {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  gradeLevel?: string | null;
  teacherId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
  description?: string | null;
  createdAt: Date;
}

export interface Lesson {
  id: string;
  topicId: string;
  title: string;
  content?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Exercise {
  id: string;
  topicId: string;
  title: string;
  instructions?: string | null;
  createdAt: Date;
}
