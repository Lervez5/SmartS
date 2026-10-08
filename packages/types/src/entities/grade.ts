export type GradeScale = "letter" | "percentage" | "points";

export interface Grade {
  id: string;
  studentId: string;
  subjectId: string;
  classId?: string | null;
  score?: number | null;
  maxScore?: number | null;
  grade?: string | null;
  type?: string | null;
  recordedAt: Date;
}

export interface GradeBook {
  id: string;
  classId: string;
  subjectId: string;
  entries: Grade[];
  createdAt: Date;
  updatedAt: Date;
}
