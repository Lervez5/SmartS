'use client';

import * as React from 'react';
import { useAuth } from '@schoolos/auth';
import { useApi } from '@schoolos/hooks';
import {
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  ContextFilterBar,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';
import { Search, XCircle, Users, UserCheck, UserCog, BookOpenCheck, Building2, Calendar } from 'lucide-react';

/**
 * My Classes page for the Teacher Portal.
 *
 * Shows the teacher's class assignments with responsibilities and learning areas.
 * Data comes from GET /api/teachers/my-classes.
 */

interface TeacherClass {
  id: string;
  name: string;
  gradeLevel?: string | null;
  academicYear?: { id: string; name: string; label?: string | null };
  responsibilities: Array<{
    type: 'class' | 'stream';
    responsibility: 'main_class_teacher' | 'assistant_class_teacher' | 'subject_teacher';
    canManage: boolean;
    canEnterResults: boolean;
    stream?: {
      id: string;
      name: string;
      code: string;
      class: { id: string; name: string; gradeLevel?: string | null };
    } | null;
    learningArea?: {
      id: string;
      name: string;
      code?: string | null;
    };
    effectiveFrom?: Date;
  }>;
  streams: Array<{ id: string; name: string; code: string; learnerCount?: number }>;
  learningAreas: Array<{ id: string; name: string; code?: string | null }>;
  learnerCount: number;
}

interface MyClassesResponse {
  classes: TeacherClass[];
  total: number;
  metrics: {
    totalClasses: number;
    classTeacherClasses: number;
    assistantClassTeacherClasses: number;
    subjectTeacherClasses: number;
    totalStreams: number;
    totalLearningAreas: number;
  };
  scope: { schoolId: string; academicYearId?: string };
}

interface FilterState {
  search: string;
  responsibility: string;
  academicYear: string;
}

const RESPONSIBILITY_LABELS: Record<string, string> = {
  main_class_teacher: 'Class Teacher',
  assistant_class_teacher: 'Assistant Class Teacher',
  subject_teacher: 'Subject Teacher',
};

const RESPONSIBILITY_COLORS: Record<string, StatusTone> = {
  main_class_teacher: 'info',
  assistant_class_teacher: 'neutral',
  subject_teacher: 'brand',
};

function formatAcademicSession(year?: { name?: string; label?: string | null } | null): string {
  if (!year) return 'No session';
  return year.label || year.name || 'Unknown';
}

export default function MyClassesPage() {
  const { user } = useAuth();
  const [filters, setFilters] = React.useState<FilterState>({
    search: '',
    responsibility: '',
    academicYear: '',
  });

  const { data, loading, error, refetch } = useApi<MyClassesResponse>('/api/teachers/my-classes');

  const filteredClasses = React.useMemo(() => {
    if (!data?.classes) return [];

    return data.classes.filter((cls) => {
      if (filters.search && !cls.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.responsibility && !cls.responsibilities.some(
        (resp) => resp.responsibility === filters.responsibility
      )) {
        return false;
      }
      if (filters.academicYear && cls.academicYear?.id !== filters.academicYear) {
        return false;
      }
      return true;
    });
  }, [data?.classes, filters]);

  const getResponsibilityOptions = (): Array<{ value: string; label: string }> => {
    return [
      { value: '', label: 'All responsibilities' },
      { value: 'main_class_teacher', label: 'Class Teacher' },
      { value: 'assistant_class_teacher', label: 'Assistant Class Teacher' },
      { value: 'subject_teacher', label: 'Subject Teacher' },
    ];
  };

  const getAcademicSessionOptions = (): Array<{ value: string; label: string }> => {
    if (!data?.scope.academicYearId) return [];
    return [
      { value: data.scope.academicYearId, label: `Academic Session ${data.scope.academicYearId.slice(0, 4)}` },
    ];
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ search: '', responsibility: '', academicYear: '' });
  };

  const hasActiveFilters = Object.values(filters).some((value) => value !== '');

  const classColumns: Array<DataTableColumn<TeacherClass>> = [
    {
      id: 'class',
      header: 'Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Grade {row.gradeLevel || '-'}
          </p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'responsibilities',
      header: 'Responsibilities',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.responsibilities.map((resp, idx) => (
            <StatusPill
              key={idx}
              label={RESPONSIBILITY_LABELS[resp.responsibility] || resp.responsibility.replace('_', ' ')}
              tone={RESPONSIBILITY_COLORS[resp.responsibility] || 'neutral'}
              className="text-xs"
            />
          ))}
        </div>
      ),
      hideBelow: 'md',
    },
    {
      id: 'streams',
      header: 'Streams',
      cell: (row) => row.streams.length,
      align: 'right',
      hideBelow: 'sm',
    },
    {
      id: 'areas',
      header: 'Learning Areas',
      cell: (row) => row.learningAreas.length,
      align: 'right',
      hideBelow: 'md',
    },
    {
      id: 'learners',
      header: 'Learners',
      cell: (row) => row.learnerCount || 0,
      align: 'right',
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <div className="text-xs text-muted-foreground text-right">
          Click to open
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="My Classes"
          description="Your classes, teaching responsibilities and learning areas in one place."
        />
        <LoadingState label="Loading your classes" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="My Classes"
          description="Your classes, teaching responsibilities and learning areas in one place."
        />
        <ErrorState
          title="Could not load your classes"
          message={error instanceof Error ? error.message : 'An unknown error occurred'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!data?.classes || data.classes.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="My Classes"
          description="Your classes, teaching responsibilities and learning areas in one place."
        />

        {hasActiveFilters ? (
          <EmptyState
            title="No classes match your filters"
            description="Try adjusting your search or filter criteria to find the classes you're looking for."
            icon="search-x"
            action={(
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Clear all filters
              </button>
            )}
          />
        ) : (
          <EmptyState
            title="No classes assigned yet"
            description="You haven't been assigned to any classes yet. A DEAN or SUPER_ADMIN needs to allocate you to classes and assign teaching responsibilities before you can access them here."
            icon="users-round"
            action={(
              <div className="text-center text-xs text-muted-foreground">
                Contact your academic administrator if this seems incorrect."
              </div>
            )}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="My Classes"
        description="Your classes, teaching responsibilities and learning areas in one place."
      />

      {/* Summary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardCard
          title="Total classes"
          value={data.metrics.totalClasses}
          icon="users-round"
          tone="accent"
          description="Classes you're assigned to"
        />
        <DashboardCard
          title="Class teachers"
          value={data.metrics.classTeacherClasses}
          icon="user-check"
          tone="accent"
          description="Where you're the main class teacher"
        />
        <DashboardCard
          title="Assistant teachers"
          value={data.metrics.assistantClassTeacherClasses}
          icon="user-plus"
          tone="accent"
          description="As assistant class teacher"
        />
        <DashboardCard
          title="Subject teachers"
          value={data.metrics.subjectTeacherClasses}
          icon="book-open-check"
          tone="accent"
          description="Where you teach a learning area"
        />
        <DashboardCard
          title="Streams"
          value={data.metrics.totalStreams}
          icon="building-2"
          tone="accent"
          description="Total streams across all classes"
        />
      </div>

      {/* Search and filters */}
      <ContextFilterBar
        search={{
          value: filters.search,
          onChange: (value) => handleFilterChange('search', value),
          placeholder: 'Search classes by name...',
        }}
        filters={[
          {
            id: 'responsibility',
            label: 'Responsibility',
            value: filters.responsibility,
            options: getResponsibilityOptions(),
            onChange: (value) => handleFilterChange('responsibility', value),
          },
          {
            id: 'academicYear',
            label: 'Academic Session',
            value: filters.academicYear,
            options: getAcademicSessionOptions(),
            onChange: (value) => handleFilterChange('academicYear', value),
          },
        ]}
        actions={hasActiveFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <XCircle className="h-4 w-4" />
            Clear filters
          </button>
        ) : null}
      />

      {/* Class cards for mobile/tablet view */}
      <div className="grid grid-cols-1 gap-4 lg:hidden">
        {filteredClasses.map((cls) => (
          <div key={cls.id} className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold">
              {cls.name} {cls.gradeLevel ? `(Grade ${cls.gradeLevel})` : null}
            </h3>
            <div className="mt-2 flex flex-wrap gap-1">
              {cls.responsibilities.map((resp, idx) => (
                <StatusPill
                  key={idx}
                  label={RESPONSIBILITY_LABELS[resp.responsibility] || resp.responsibility.replace('_', ' ')}
                  tone={RESPONSIBILITY_COLORS[resp.responsibility] || 'neutral'}
                  className="text-xs"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Data table for desktop view */}
      <div className="hidden lg:block">
        <DataTable
          caption="Your assigned classes and teaching assignments"
          columns={classColumns}
          rows={filteredClasses}
          rowKey={(row) => row.id}
          pageSize={10}
          empty={
            <EmptyState
              title="No classes match your filters"
              description="Try adjusting your search or filter criteria to find the classes you're looking for."
              icon="search-x"
              action={hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  Clear filters
                </button>
              ) : null}
            />
          }
        />
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <span className="font-medium">Active filters: "</span>
          {filters.search && <span className="font-medium text-foreground">Search: {filters.search}, "</span>}
          {filters.responsibility && <span className="font-medium text-foreground">Responsibility: {RESPONSIBILITY_LABELS[filters.responsibility] || filters.responsibility}, "</span>}
          {filters.academicYear && <span className="font-medium text-foreground">Academic Session: Selected, "</span>}
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-primary hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
