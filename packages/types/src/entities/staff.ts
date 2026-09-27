import type { User, Gender } from "./user";

export type StaffStatus = "active" | "on_leave" | "terminated" | "archived";

export interface StaffProfile {
  id: string;
  userId: string;
  user?: User;
  employeeId?: string | null;
  department?: string | null;
  position?: string | null;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  hireDate?: Date | null;
  status: StaffStatus;
  salary?: number | null;
  createdAt: Date;
  updatedAt: Date;
}
