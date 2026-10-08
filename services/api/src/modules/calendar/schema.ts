import { z } from 'zod';

export const EVENT_COLORS = {
  class_session: '#22c55e',
  assignment_due: '#f59e0b',
  quiz: '#8b5cf6',
  examination: '#ef4444',
  school_event: '#3b82f6',
  holiday: '#64748b',
  personal_reminder: '#06b6d4',
  meeting: '#ec4899',
} as const;

const eventType = z.enum([
  'class_session',
  'assignment_due',
  'quiz',
  'examination',
  'school_event',
  'holiday',
  'personal_reminder',
  'meeting',
]);

const visibility = z.enum(['personal', 'class', 'school']);

export const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  type: eventType,
  startDate: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endDate: z.string().optional(),
  allDay: z.boolean().optional(),
  classId: z.string().optional(),
  assignmentId: z.string().optional(),
  visibility: visibility.optional(),
  color: z.string().optional(),
});

export const updateEventSchema = createEventSchema.partial();

export const listEventsSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  type: eventType.optional(),
  classId: z.string().optional(),
});

export type CreateEventDto = z.infer<typeof createEventSchema>;
export type UpdateEventDto = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsSchema>;
