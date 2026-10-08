export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: Date;
  status: AttendanceStatus;
  recordedBy?: string | null;
  createdAt: Date;
}
