'use client';

import { useApi } from '@schoolos/hooks';
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * `GET /api/calendar/events` - the service resolves visibility from the caller's
 * id and role (`getEvents(req.user.id, req.user.role, query)`), so a learner
 * only sees personal and school-wide events rather than another class's.
 */
interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  type: string;
  startDate: string;
  endDate?: string | null;
  allDay?: boolean;
  visibility?: string | null;
  color?: string | null;
  classId?: string | null;
}

const TYPE_TONE: Record<string, 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  class_session: 'brand',
  assignment_due: 'warning',
  quiz: 'info',
  examination: 'danger',
  school_event: 'info',
  holiday: 'success',
  meeting: 'neutral',
  personal_reminder: 'neutral',
};

function formatRange(event: CalendarEvent): string {
  const start = new Date(event.startDate);
  if (Number.isNaN(start.getTime())) return '-';
  const base = start.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: event.allDay ? undefined : '2-digit',
    minute: event.allDay ? undefined : '2-digit',
  });
  if (!event.endDate) return base;
  const end = new Date(event.endDate);
  if (Number.isNaN(end.getTime())) return base;
  return `${base} → ${end.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}

export default function CalendarPage() {
  const { data, loading, error } = useApi<CalendarEvent[]>('/api/calendar/events');

  const events = data ?? [];

  const columns: Array<DataTableColumn<CalendarEvent>> = [
    {
      id: 'title',
      header: 'Event',
      cell: (row) => (
        <span className="font-medium text-foreground">
          {row.title}
          {row.description ? (
            <span className="mt-0.5 block max-w-md text-xs text-muted-foreground">
              {row.description}
            </span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.title,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <StatusPill label={row.type.replace(/_/g, ' ')} tone={TYPE_TONE[row.type] ?? 'neutral'} />
      ),
      hideBelow: 'sm',
    },
    {
      id: 'visibility',
      header: 'Visibility',
      hideBelow: 'lg',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.visibility ?? '-'}</span>,
    },
    {
      id: 'when',
      header: 'When',
      align: 'right',
      cell: (row) => formatRange(row),
      sortValue: (row) => row.startDate,
    },
  ];

  if (loading) return <LoadingState label="Loading the school calendar" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load the calendar"
        message="Confirm the API is running and that you are signed in."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="School Calendar"
        description="Events, deadlines and sessions you are permitted to see."
      />
      <DataTable
        caption="Calendar events visible to the signed-in user"
        columns={columns}
        rows={events}
        rowKey={(row) => row.id}
        pageSize={15}
        empty={
          <EmptyState
            title="Nothing scheduled"
            description="No events are visible to you yet."
            icon="calendar"
          />
        }
      />
    </div>
  );
}
