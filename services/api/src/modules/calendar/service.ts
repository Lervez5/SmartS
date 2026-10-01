import { CalendarEventType, Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { EVENT_COLORS, CreateEventDto, UpdateEventDto, ListEventsQuery } from './schema';
import { recordAuditLog } from '../audit-logs/service';

function colorFor(type: string, fallback?: string | null): string {
  if (fallback) return fallback;
  return (EVENT_COLORS as Record<string, string>)[type] ?? '#22c55e';
}

/** Class ids a student is enrolled in, used to scope class-visible events. */
async function classIdsForStudent(userId: string): Promise<string[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: userId },
    select: { classId: true },
  });
  return enrollments.map((e) => e.classId);
}

export async function getEvents(userId: string, userRole: string, query: ListEventsQuery) {
  const studentClassIds = userRole === 'student' ? await classIdsForStudent(userId) : [];

  const visibilityFilter: Prisma.CalendarEventWhereInput[] = [
    { createdBy: userId },
    { visibility: 'school' },
  ];

  if (userRole === 'student') {
    visibilityFilter.push({
      visibility: 'class',
      classId: { in: studentClassIds },
    });
  } else if (userRole === 'teacher') {
    // Teachers also see events shared with any class they teach.
    const taught = await prisma.class.findMany({
      where: { teacherId: userId },
      select: { id: true },
    });
    visibilityFilter.push({
      visibility: 'class',
      classId: { in: taught.map((c) => c.id) },
    });
  } else {
    visibilityFilter.push({ visibility: 'class' });
  }

  const where: Prisma.CalendarEventWhereInput = {
    OR: visibilityFilter,
    ...(query.start || query.end
      ? {
          startDate: {
            ...(query.start ? { gte: new Date(query.start) } : {}),
            ...(query.end ? { lte: new Date(query.end) } : {}),
          },
        }
      : {}),
    ...(query.type ? { type: query.type as CalendarEventType } : {}),
    ...(query.classId ? { classId: query.classId } : {}),
  };

  const events = await prisma.calendarEvent.findMany({
    where,
    orderBy: { startDate: 'asc' },
    take: 200,
  });

  return events.map((e) => ({ ...e, color: colorFor(e.type, e.color) }));
}

export async function createEvent(userId: string, dto: CreateEventDto) {
  const event = await prisma.calendarEvent.create({
    data: {
      title: dto.title,
      description: dto.description,
      type: dto.type as CalendarEventType,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      allDay: dto.allDay ?? false,
      classId: dto.classId,
      assignmentId: dto.assignmentId,
      createdBy: userId,
      visibility: dto.visibility ?? 'personal',
      color: colorFor(dto.type, dto.color),
    },
  });

  if (dto.visibility === 'school' || dto.visibility === 'class') {
    await recordAuditLog(
      userId,
      'CREATE_SHARED_EVENT',
      `Created ${dto.visibility} event: ${event.title} (${event.id})`
    );
  }

  return event;
}

export async function updateEvent(userId: string, eventId: string, dto: UpdateEventDto) {
  const existing = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  });
  if (!existing) throw new Error('Event not found.');
  if (existing.createdBy !== userId) throw new Error('Access denied.');

  const data: Prisma.CalendarEventUpdateInput = {};
  if (dto.title !== undefined) data.title = dto.title;
  if (dto.description !== undefined) data.description = dto.description;
  if (dto.type !== undefined) {
    data.type = dto.type as CalendarEventType;
    data.color = colorFor(dto.type, dto.color);
  }
  if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
  if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
  if (dto.allDay !== undefined) data.allDay = dto.allDay;
  if (dto.visibility !== undefined) data.visibility = dto.visibility;
  if (dto.color !== undefined) data.color = dto.color;

  const event = await prisma.calendarEvent.update({
    where: { id: eventId },
    data,
  });

  const isShared =
    existing.visibility === 'school' ||
    existing.visibility === 'class' ||
    dto.visibility === 'school' ||
    dto.visibility === 'class';
  if (isShared) {
    await recordAuditLog(
      userId,
      'UPDATE_SHARED_EVENT',
      `Updated shared event: ${event.title} (${event.id})`
    );
  }

  return event;
}

export async function deleteEvent(userId: string, eventId: string) {
  const existing = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
  });
  if (!existing) throw new Error('Event not found.');
  if (existing.createdBy !== userId) throw new Error('Access denied.');
  return prisma.calendarEvent.delete({ where: { id: eventId } });
}

export async function getToday(userId: string, userRole: string) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);

  const events = await prisma.calendarEvent.findMany({
    where: {
      startDate: { gte: dayStart, lte: dayEnd },
      OR: [{ createdBy: userId }, { visibility: 'school' }, { visibility: 'class' }],
    },
    orderBy: { startDate: 'asc' },
  });

  return events.map((e) => ({
    ...e,
    color: colorFor(e.type, e.color),
    userRole,
  }));
}

/** Project a teacher's ClassSchedule rows into calendar events for a window. */
export async function getTimedSessions(teacherId: string, start: Date, end: Date) {
  const classes = await prisma.class.findMany({
    where: { teacherId },
    select: {
      id: true,
      name: true,
      subject: { select: { name: true } },
      schedules: true,
    },
  });

  const events: Array<Record<string, unknown>> = [];
  for (const cls of classes) {
    for (const s of cls.schedules) {
      if (s.validFrom > end) continue;
      if (s.validUntil && s.validUntil < start) continue;
      events.push({
        id: `schedule-${cls.id}-${s.id}`,
        title: cls.subject?.name ?? cls.name,
        type: 'class_session',
        startDate: s.validFrom,
        allDay: false,
        classId: cls.id,
        room: s.room,
        color: EVENT_COLORS.class_session,
        visibility: 'class',
      });
    }
  }
  return events;
}
