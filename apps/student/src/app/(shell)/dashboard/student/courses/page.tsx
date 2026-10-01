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
 * `GET /api/courses/student/my-courses` - gated by `courses.view` and scoped by
 * the API to the signed-in learner (`getStudentCourses(req.user.id)`).
 *
 * The endpoint returns the learner's `CourseEnrollment` rows with the course
 * nested, so completion is the enrollment's own `progress` value.
 *
 * The previous version of this page called `GET /api/dashboard`, which is not a
 * registered route and answered 404.
 */
interface Enrollment {
  id: string;
  progress: number;
  status?: string | null;
  course?: {
    id: string;
    title: string;
    code?: string | null;
    description?: string | null;
    category?: string | null;
  } | null;
}

export default function StudentCoursesPage() {
  const { data, loading, error } = useApi<Enrollment[]>('/api/courses/student/my-courses');

  const rows = data ?? [];

  const columns: Array<DataTableColumn<Enrollment>> = [
    {
      id: 'title',
      header: 'Course',
      cell: (row) => (
        <span className="font-medium text-foreground">
          {row.course?.title ?? 'Untitled course'}
          {row.course?.description ? (
            <span className="mt-0.5 block max-w-md text-xs text-muted-foreground">
              {row.course.description}
            </span>
          ) : null}
        </span>
      ),
      sortValue: (row) => row.course?.title ?? '',
    },
    {
      id: 'code',
      header: 'Code',
      cell: (row) => row.course?.code ?? '-',
      hideBelow: 'sm',
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'md',
      cell: (row) => (
        <StatusPill
          label={(row.status ?? 'active').replace(/_/g, ' ')}
          tone={row.status === 'completed' ? 'success' : 'neutral'}
        />
      ),
    },
    {
      id: 'progress',
      header: 'Progress',
      align: 'right',
      cell: (row) => {
        const percent = Math.round(row.progress ?? 0);
        return (
          <div className="flex items-center justify-end gap-2">
            <div
              className="h-1.5 w-24 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${row.course?.title ?? 'Course'} progress`}
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
              />
            </div>
            <span className="w-9 text-right text-sm font-medium">{percent}%</span>
          </div>
        );
      },
      sortValue: (row) => row.progress ?? 0,
    },
  ];

  if (loading) return <LoadingState label="Loading your courses" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load your courses"
        message="GET /api/courses/student/my-courses requires courses.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Courses"
        description="Courses you are enrolled in, with completion from your learning record."
      />
      <DataTable
        caption="Courses the signed-in learner is enrolled in"
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        pageSize={10}
        empty={
          <EmptyState
            title="No courses yet"
            description="You are not enrolled in any course. Enrolment is managed by your teacher or the school administration."
            icon="book-open"
          />
        }
      />
    </div>
  );
}
