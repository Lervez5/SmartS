export interface BulkScheduleDto {
    schedules: ScheduleRowDto[];
}

export interface ScheduleRowDto {
    className: string;
    dayOfWeek: number;  // 0=Sun … 6=Sat
    startTime: string;  // "HH:MM"
    endTime: string;    // "HH:MM"
    room?: string;
    recurrence?: "weekly" | "biweekly" | "daily";
    validFrom: string;  // ISO date
    validUntil?: string;
}

export const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
