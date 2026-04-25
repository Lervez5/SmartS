export type AttendanceStatus = "present" | "absent" | "late" | "excused" | "sick" | "on_leave";

export interface MarkAttendanceRecord {
    studentId: string;
    status: AttendanceStatus;
    note?: string;
}

export interface MarkAttendanceDto {
    classId: string;
    date: string; // ISO date string YYYY-MM-DD
    records: MarkAttendanceRecord[];
    isDraft?: boolean;
}

export interface AttendanceQueryDto {
    classId?: string;
    studentId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
}

export const VALID_STATUSES: AttendanceStatus[] = [
    "present", "absent", "late", "excused", "sick", "on_leave"
];
