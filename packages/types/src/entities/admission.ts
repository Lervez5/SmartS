import type { Gender } from "./user";

export type AdmissionStatus = "pending" | "review" | "accepted" | "rejected" | "withdrawn";

export interface StudentProfileAdmission {
  id: string;
  userId: string;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  gradeLevel?: string | null;
  enrollmentDate?: Date | null;
  createdAt: Date;
}
