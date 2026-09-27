export interface Assignment {
  id: string;
  title: string;
  description?: string | null;
  classId?: string | null;
  subjectId?: string | null;
  dueDate?: Date | null;
  maxScore?: number | null;
  createdAt: Date;
}

export type SubmissionStatus = "draft" | "submitted" | "graded";

export interface Submission {
  id: string;
  assignmentId: string;
  assignment?: Assignment;
  studentId: string;
  status: SubmissionStatus;
  submittedAt?: Date | null;
  score?: number | null;
  feedback?: string | null;
}
