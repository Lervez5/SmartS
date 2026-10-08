import type { User, Gender } from "./user";

export interface StudentProfile {
  id: string;
  userId: string;
  user?: User;
  admissionId?: string | null;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  gradeLevel?: string | null;
  enrollmentDate?: Date | null;
  createdAt: Date;
}
