export type CalendarEventType =
    | "class_session"
    | "assignment_due"
    | "quiz"
    | "examination"
    | "school_event"
    | "holiday"
    | "personal_reminder"
    | "meeting";

export interface CreateCalendarEventDto {
    title: string;
    description?: string;
    type: CalendarEventType;
    startDate: string; // ISO
    endDate?: string;  // ISO
    allDay?: boolean;
    classId?: string;
    assignmentId?: string;
    visibility?: "personal" | "class" | "school";
    color?: string;
}

export interface UpdateCalendarEventDto extends Partial<CreateCalendarEventDto> {}

export interface CalendarQueryDto {
    start?: string;
    end?: string;
    type?: CalendarEventType;
    classId?: string;
}

export const EVENT_COLORS: Record<CalendarEventType, string> = {
    class_session:     "#22c55e",
    assignment_due:    "#f59e0b",
    quiz:              "#8b5cf6",
    examination:       "#ef4444",
    school_event:      "#3b82f6",
    holiday:           "#64748b",
    personal_reminder: "#06b6d4",
    meeting:           "#ec4899",
};
