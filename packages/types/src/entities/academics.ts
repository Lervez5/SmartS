export interface Class {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  gradeLevel?: string | null;
  teacherId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enrollment {
  id: string;
  studentId: string;
  classId: string;
  class?: Class;
  enrolledAt: Date;
}

export interface ClassSchedule {
  id: string;
  classId: string;
  class?: Class;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectId?: string | null;
  room?: string | null;
}
