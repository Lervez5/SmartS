export interface Exam {
  id: string;
  name: string;
  description?: string | null;
  subjectId?: string | null;
  classId?: string | null;
  examDate?: Date | null;
  maxScore?: number | null;
  createdAt: Date;
}

export interface ExamSchedule {
  id: string;
  examId: string;
  exam?: Exam;
  classId?: string | null;
  startTime?: Date | null;
  endTime?: Date | null;
  room?: string | null;
}

export interface ExamResult {
  id: string;
  examId: string;
  studentId: string;
  score?: number | null;
  grade?: string | null;
  feedback?: string | null;
  createdAt: Date;
}
