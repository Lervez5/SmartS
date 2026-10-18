'use client';

import * as React from 'react';
import { useAuth } from '@schoolos/auth';
import { useApi } from '@schoolos/hooks';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  Select,
  StatusPill,
  TextArea,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';
import { Plus, Edit, Trash2, Calendar, Tag } from 'lucide-react';

interface LearnerRow {
  id: string;
  name: string | null;
  email: string | null;
  avatar: string | null;
  studentProfile: { gradeLevel: string | null };
  classes: Array<{
    classId: string;
    streamId: string | null;
    className: string;
    gradeLevel: string | null;
  }>;
}

interface LearnersResponse {
  learners: LearnerRow[];
  subjects: Array<{ id: string; name: string; code: string | null }>;
  academicYearId: string | null;
  note?: string;
}

interface GradeRow {
  id: string;
  value: number | null;
  scale: number | null;
  competencyLevel: string | null;
  racefieldBandCode: string | null;
  racefieldPoints: number | null;
  comment: string | null;
  gradedAt: Date | null;
  subject: { id: string; name: string; code: string | null };
  class: { id: string; name: string; gradeLevel: string | null };
  exam: {
    id: string;
    title: string;
    status: string;
    maxScore: number | null;
    startDate: Date | null;
    endDate: Date | null;
    term: { id: string; name: string; termNumber: number | null };
    academicYear: { id: string; name: string; label: string | null };
  };
}

interface ObservationRow {
  id: string;
  text: string;
  visibility: 'draft' | 'finalised';
  createdAt: Date;
  updatedAt: Date;
  subject: { id: string; name: string; code: string | null };
  class: { id: string; name: string; gradeLevel: string | null };
  term: { id: string; name: string; termNumber: number | null };
  academicYear: { id: string; name: string; label: string | null };
}

interface SubjectSummaryRow {
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  assessmentCount: number;
  average: number | null;
  latest: {
    id: string;
    value: number | null;
    scale: number | null;
    competencyLevel: string | null;
    racefieldBandCode: string | null;
    racefieldPoints: number | null;
    comment: string | null;
    class: { id: string; name: string; gradeLevel: string | null };
    subject: { id: string; name: string; code: string | null };
    exam: {
      id: string;
      title: string;
      status: string;
      maxScore: number | null;
      startDate: Date | null;
      endDate: Date | null;
      term: { id: string; name: string; termNumber: number | null };
      academicYear: { id: string; name: string; label: string | null };
    };
    gradedAt: Date | null;
  } | null;
  latestBandCode: string | null;
  latestPoints: number | null;
  latestCompetency: string | null;
}

interface LearnerProgressResponse {
  learner: {
    id: string;
    name: string | null;
    email: string | null;
    avatar: string | null;
    studentProfile: { gradeLevel: string | null; dateOfBirth: Date | null; gender: string | null };
    classes: Array<{ classId: string; allStreams: boolean; entersAllAreas: boolean }>;
  };
  academicYearId: string | null;
  grades: GradeRow[];
  observations: ObservationRow[];
  subjectSummaries: SubjectSummaryRow[];
}

interface ObservationForm {
  text: string;
  subjectId: string;
  visibility: 'draft' | 'finalised';
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getBandLabel(code: string | null): string {
  const bands: Record<string, string> = {
    A: 'Excellent',
    B: 'Good',
    C: 'Satisfactory',
    D: 'Needs Improvement',
    E: 'Weak',
    F: 'Fail',
  };
  if (!code) return '—';
  return bands[code] ?? code;
}

function getGradeLevel(learner: LearnerRow): string {
  return (
    learner.classes.find((c) => c.gradeLevel)?.gradeLevel ??
    learner.studentProfile.gradeLevel ??
    '—'
  );
}

const learnerColumns: Array<DataTableColumn<LearnerRow>> = [
  {
    id: 'learner',
    header: 'Learner',
    cell: (row) => (
      <div className="flex items-center gap-3">
        {row.avatar ? (
          <img
            src={row.avatar}
            alt={row.name ?? ''}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
            {row.name?.[0] ?? '?'}
          </div>
        )}
        <div>
          <p className="font-medium text-foreground">{row.name ?? 'Unnamed learner'}</p>
          {row.email ? <p className="text-xs text-muted-foreground">{row.email}</p> : null}
        </div>
      </div>
    ),
    sortValue: (row) => row.name ?? '',
  },
  {
    id: 'classes',
    header: 'Class / Stream',
    cell: (row) => (
      <div className="text-sm text-muted-foreground">
        {row.classes.length === 0 ? 'No classes' : row.classes.map((c) => c.className).join(', ')}
      </div>
    ),
  },
  {
    id: 'gradeLevel',
    header: 'Grade',
    cell: (row) => <span className="text-sm">{getGradeLevel(row)}</span>,
  },
];

const subjectSummaryColumns: Array<DataTableColumn<SubjectSummaryRow>> = [
  {
    id: 'subject',
    header: 'Learning Area',
    cell: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.subjectName}</p>
        {row.subjectCode ? (
          <p className="text-xs text-muted-foreground">{row.subjectCode}</p>
        ) : null}
      </div>
    ),
    sortValue: (row) => row.subjectName,
  },
  {
    id: 'assessments',
    header: 'Assessments',
    align: 'right',
    cell: (row) => <span className="text-sm">{row.assessmentCount}</span>,
    sortValue: (row) => row.assessmentCount,
  },
  {
    id: 'average',
    header: 'Average',
    align: 'right',
    cell: (row) => (
      <span className="text-sm font-medium text-foreground">
        {row.average !== null ? Number(row.average).toFixed(1) : '—'}
      </span>
    ),
    sortValue: (row) => row.average ?? -1,
  },
  {
    id: 'latestBand',
    header: 'Latest Band',
    cell: (row) => {
      let tone: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral';
      if (row.latestBandCode === 'A' || row.latestBandCode === 'B') tone = 'success';
      else if (row.latestBandCode === 'F') tone = 'danger';
      return (
        <div className="flex items-center gap-2">
          <StatusPill label={row.latestBandCode ?? '—'} tone={tone} />
          <span className="text-xs text-muted-foreground">{getBandLabel(row.latestBandCode)}</span>
        </div>
      );
    },
    sortValue: (row) => row.latestBandCode ?? 'Z',
  },
  {
    id: 'latestPoints',
    header: 'Points',
    align: 'right',
    cell: (row) => (
      <span className="text-sm text-muted-foreground">
        {row.latestPoints !== null ? `${row.latestPoints} pts` : '—'}
      </span>
    ),
    sortValue: (row) => row.latestPoints ?? -1,
  },
  {
    id: 'competency',
    header: 'Competency',
    cell: (row) => <span className="text-sm">{row.latestCompetency ?? '—'}</span>,
  },
];

const gradeColumns: Array<DataTableColumn<GradeRow>> = [
  {
    id: 'subject',
    header: 'Learning Area',
    cell: (row) => (
      <div>
        <p className="font-medium text-foreground">{row.subject?.name ?? '—'}</p>
        {row.subject?.code ? (
          <p className="text-xs text-muted-foreground">{row.subject.code}</p>
        ) : null}
      </div>
    ),
    sortValue: (row) => row.subject?.name ?? '',
  },
  {
    id: 'assessment',
    header: 'Assessment',
    cell: (row) => (
      <div>
        <p className="text-sm font-medium text-foreground">{row.exam?.title ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {row.exam?.term?.name ?? ''} · {row.exam?.academicYear?.label ?? ''}
        </p>
      </div>
    ),
    sortValue: (row) => row.exam?.title ?? '',
  },
  {
    id: 'score',
    header: 'Score',
    align: 'right',
    cell: (row) => (
      <span className="text-sm font-medium text-foreground">
        {row.value !== null ? `${row.value}${row.scale ? `/${row.scale}` : ''}` : '—'}
      </span>
    ),
    sortValue: (row) => row.value ?? -1,
  },
  {
    id: 'band',
    header: 'Band',
    cell: (row) => (
      <div className="flex items-center gap-2">
        <StatusPill
          label={row.racefieldBandCode ?? '—'}
          tone={row.racefieldBandCode === 'F' ? 'danger' : 'neutral'}
        />
        {row.racefieldPoints !== null ? (
          <span className="text-xs text-muted-foreground">{row.racefieldPoints} pts</span>
        ) : null}
      </div>
    ),
    sortValue: (row) => row.racefieldBandCode ?? 'Z',
  },
  {
    id: 'competency',
    header: 'Level',
    cell: (row) => <span className="text-sm">{row.competencyLevel ?? '—'}</span>,
    sortValue: (row) => row.competencyLevel ?? 'Z',
  },
  {
    id: 'date',
    header: 'Date',
    cell: (row) => (
      <span className="text-sm text-muted-foreground">{formatDate(row.gradedAt)}</span>
    ),
    sortValue: (row) => (row.gradedAt ? new Date(row.gradedAt).getTime() : 0),
  },
];

function observationColumns(
  canManage: boolean,
  onEdit: (obs: ObservationRow) => void,
  onDelete: (obs: ObservationRow) => void
): Array<DataTableColumn<ObservationRow>> {
  return [
    {
      id: 'observation',
      header: 'Observation',
      cell: (row) => (
        <div>
          <p className="text-sm text-foreground">{row.text}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {row.subject ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                <Tag className="h-3 w-3" />
                {row.subject.name}
              </span>
            ) : null}
            {row.term ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {row.term.name}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'visibility',
      header: 'Status',
      cell: (row) => (
        <StatusPill
          label={row.visibility === 'finalised' ? 'Finalised' : 'Draft'}
          tone={row.visibility === 'finalised' ? 'success' : 'neutral'}
        />
      ),
      sortValue: (row) => row.visibility,
    },
    {
      id: 'updated',
      header: 'Updated',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.updatedAt)}</span>
      ),
      sortValue: (row) => (row.updatedAt ? new Date(row.updatedAt).getTime() : 0),
    },
    {
      id: 'actions',
      header: '',
      cell: (row) =>
        canManage ? (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(row)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(row)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ];
}

export default function ProgressPage() {
  const { can } = useAuth();
  const [selectedLearnerId, setSelectedLearnerId] = React.useState<string | null>(null);
  const [showObservationModal, setShowObservationModal] = React.useState(false);
  const [editingObservation, setEditingObservation] = React.useState<ObservationRow | null>(null);
  const [observationForm, setObservationForm] = React.useState<ObservationForm>({
    text: '',
    subjectId: '',
    visibility: 'draft',
  });

  const learnersApi = useApi<LearnersResponse>('/api/progress/learners');

  const learnerDetailUrl =
    selectedLearnerId && learnersApi.data?.academicYearId
      ? `/api/progress/learner/${selectedLearnerId}?academicYearId=${learnersApi.data.academicYearId}`
      : selectedLearnerId
        ? `/api/progress/learner/${selectedLearnerId}`
        : null;
  const learnerApi = useApi<LearnerProgressResponse>(learnerDetailUrl);

  React.useEffect(() => {
    if (learnersApi.data?.learners && learnersApi.data.learners.length > 0 && !selectedLearnerId) {
      setSelectedLearnerId(learnersApi.data.learners[0].id);
    }
  }, [learnersApi.data?.learners, selectedLearnerId]);

  const handleAddObservation = () => {
    const subjectOptions = learnersApi.data?.subjects ?? [];
    setObservationForm({
      text: '',
      subjectId: subjectOptions.length > 0 ? subjectOptions[0].id : '',
      visibility: 'draft',
    });
    setEditingObservation(null);
    setShowObservationModal(true);
  };

  const handleEditObservation = (obs: ObservationRow) => {
    setEditingObservation(obs);
    setObservationForm({
      text: obs.text,
      subjectId: obs.subject?.id ?? '',
      visibility: obs.visibility,
    });
    setShowObservationModal(true);
  };

  const handleDeleteObservation = async (obs: ObservationRow) => {
    if (!confirm(`Delete observation for ${learnerApi.data?.learner.name ?? 'this learner'}?`))
      return;
    try {
      const res = await fetch(`/api/progress/observation/${obs.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Delete failed (HTTP ${res.status}).`);
        return;
      }
      notify.success('Observation deleted.');
      learnerApi.refetch();
    } catch {
      notify.error('Could not reach the API.');
    }
  };

  const submitObservation = async () => {
    if (!observationForm.text.trim()) {
      notify.error('Observation text is required.');
      return;
    }
    const learnerClasses = learnerApi.data?.learner.classes ?? [];
    const classId = learnerClasses[0]?.classId;
    if (!classId) {
      notify.error('No class available for this observation.');
      return;
    }

    const payload = {
      learnerId: selectedLearnerId,
      classId,
      subjectId: observationForm.subjectId || undefined,
      text: observationForm.text.trim(),
      visibility: observationForm.visibility,
    };

    try {
      const url = editingObservation
        ? `/api/progress/observation/${editingObservation.id}`
        : '/api/progress/observation';
      const method = editingObservation ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Save failed (HTTP ${res.status}).`);
        return;
      }
      notify.success(editingObservation ? 'Observation updated.' : 'Observation recorded.');
      setShowObservationModal(false);
      learnerApi.refetch();
    } catch {
      notify.error('Could not reach the API.');
    }
  };

  const subjectOptions = learnersApi.data?.subjects ?? [];
  const learners = learnersApi.data?.learners ?? [];
  const progress = learnerApi.data;

  if (learnersApi.error) {
    return (
      <ErrorState
        title="Could not load progress data"
        message="GET /api/progress/learners requires progress.view. Confirm your session holds the permission."
      />
    );
  }

  if (learnersApi.loading || !learnersApi.data) {
    return <LoadingState label="Loading learner progress" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Learner Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor academic development across your allocated classes. Grades and observations are
            scoped to your teaching allocation.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => learnersApi.refetch()}
          disabled={learnersApi.loading}
        >
          Refresh
        </Button>
      </div>

      {learnersApi.data.note ? (
        <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
          {learnersApi.data.note}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Academic Session</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {learnersApi.data.academicYearId
              ? `Session ID: ${learnersApi.data.academicYearId}`
              : 'Not configured'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">My Learners</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{learners.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Learning Areas</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{subjectOptions.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-foreground mb-2">My Learners</h2>
          <div className="max-h-[600px] overflow-y-auto rounded-lg border">
            <DataTable
              columns={learnerColumns}
              rows={learners}
              rowKey={(row) => row.id}
              onRowClick={(row) => setSelectedLearnerId(row.id)}
              empty={
                <EmptyState
                  title="No learners found"
                  description={
                    learnersApi.data.note ?? 'You have no learners in the current session.'
                  }
                  icon="users"
                />
              }
              pageSize={learners.length > 10 ? 10 : 0}
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          {selectedLearnerId ? (
            <div className="space-y-6">
              {learnerApi.loading ? (
                <LoadingState label="Loading learner progress" />
              ) : learnerApi.error ? (
                <ErrorState
                  title="Could not load learner details"
                  message="You may not be authorised to view this learner, or the server is unavailable."
                />
              ) : progress ? (
                <LearnerProgressView
                  progress={progress}
                  canManage={can('progress.manage')}
                  onAddObservation={handleAddObservation}
                  onEditObservation={handleEditObservation}
                  onDeleteObservation={handleDeleteObservation}
                  onRefetch={() => learnerApi.refetch()}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Select a learner"
              description="Choose a learner from the list to view their progress, grades, and observations."
              icon="user"
            />
          )}
        </div>
      </div>

      <Modal
        isOpen={showObservationModal}
        onClose={() => setShowObservationModal(false)}
        title={editingObservation ? 'Edit Observation' : 'Add Observation'}
        description={
          editingObservation
            ? 'Update the observation text or visibility.'
            : 'Record a new progress observation for this learner.'
        }
        size="md"
      >
        <div className="space-y-4">
          <Field label="Learning Area" hint="The subject this observation relates to (optional).">
            <Select
              value={observationForm.subjectId}
              onChange={(e) =>
                setObservationForm((prev) => ({ ...prev, subjectId: e.target.value }))
              }
            >
              <option value="">None — general observation</option>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                  {subject.code ? ` (${subject.code})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Status"
            hint="Draft stays private to you. Finalised makes it visible to other authors."
          >
            <Select
              value={observationForm.visibility}
              onChange={(e) =>
                setObservationForm((prev) => ({
                  ...prev,
                  visibility: e.target.value as 'draft' | 'finalised',
                }))
              }
            >
              <option value="draft">Draft</option>
              <option value="finalised">Finalised</option>
            </Select>
          </Field>
          <Field
            label="Observation"
            hint="Describe the learner's development at this point in time."
          >
            <TextArea
              value={observationForm.text}
              onChange={(e) => setObservationForm((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="e.g. Shows strong comprehension during group work..."
              rows={5}
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowObservationModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitObservation}>
              {editingObservation ? 'Update' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LearnerProgressView({
  progress,
  canManage,
  onAddObservation,
  onEditObservation,
  onDeleteObservation,
  onRefetch,
}: {
  progress: LearnerProgressResponse;
  canManage: boolean;
  onAddObservation: () => void;
  onEditObservation: (obs: ObservationRow) => void;
  onDeleteObservation: (obs: ObservationRow) => void;
  onRefetch: () => void;
}) {
  const { learner, subjectSummaries, grades, observations, academicYearId } = progress;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {learner.avatar ? (
            <img
              src={learner.avatar}
              alt={learner.name ?? ''}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-bold">
              {learner.name?.[0] ?? '?'}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {learner.name ?? 'Unnamed learner'}
            </h2>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {learner.studentProfile?.gradeLevel ? (
                <span>Grade: {learner.studentProfile.gradeLevel}</span>
              ) : null}
              {learner.studentProfile?.gender ? (
                <span>Gender: {learner.studentProfile.gender}</span>
              ) : null}
              {learner.classes.length > 0 ? (
                <span>
                  Classes: {learner.classes.length}
                  {learner.classes.some((c) => c.allStreams) ? ' (class-wide)' : ''}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {canManage ? (
            <Button onClick={onAddObservation}>
              <Plus className="h-4 w-4 mr-1" />
              Add Observation
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onRefetch}>
            Refresh
          </Button>
        </div>
      </div>

      {subjectSummaries.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Learning Area Summary</h3>
          <DataTable
            columns={subjectSummaryColumns}
            rows={subjectSummaries}
            rowKey={(row) => row.subjectId}
            caption="Per-subject averages and latest grade"
            pageSize={subjectSummaries.length > 8 ? 8 : 0}
          />
        </div>
      ) : (
        <EmptyState
          title="No grade data yet"
          description="Grades appear here once assessments have been entered and published for this learner."
          icon="trending-up"
        />
      )}

      {grades.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Grade History</h3>
          <DataTable
            columns={gradeColumns}
            rows={grades}
            rowKey={(row) => row.id}
            caption="All recorded grades for this learner"
            pageSize={grades.length > 10 ? 10 : 0}
          />
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Observations</h3>
          {academicYearId ? (
            <span className="text-xs text-muted-foreground">Session: {academicYearId}</span>
          ) : null}
        </div>
        {observations.length > 0 ? (
          <DataTable
            columns={observationColumns(canManage, onEditObservation, onDeleteObservation)}
            rows={observations}
            rowKey={(row) => row.id}
            caption="Teacher-authored progress observations"
            pageSize={observations.length > 8 ? 8 : 0}
          />
        ) : (
          <EmptyState
            title="No observations recorded"
            description={
              canManage
                ? 'Record the first observation using the button above.'
                : 'No observations have been recorded for this learner yet.'
            }
            icon="book-open"
          />
        )}
      </div>
    </div>
  );
}
