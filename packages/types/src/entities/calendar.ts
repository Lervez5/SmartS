export type CalendarEventType = "class" | "exam" | "holiday" | "event" | "meeting";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: CalendarEventType;
  startDate: Date;
  endDate?: Date | null;
  classId?: string | null;
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
