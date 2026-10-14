'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Modal,
  SectionHeader,
  Select,
  TextInput,
  notify,
} from '@schoolos/ui';

interface AcademicSession {
  id: string;
  name: string;
  label: string | null;
  status: string;
}

interface StreamOption {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  learnerCount: number;
  status?: string;
}

interface LearnerPlacement {
  id: string;
  userId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  avatar: string | null;
  streamId: string | null;
  streamCode: string | null;
  streamName: string | null;
  enrollmentDate: string;
}

interface ClassPlacementView {
  class: { id: string; name: string; gradeLevel: string | null };
  academicYear: { id: string; name: string; label: string | null };
  streams: StreamOption[];
  learners: LearnerPlacement[];
  learnerCounts: { total: number; unassigned: number };
  teacherAllocations: Array<{
    teacher: { id: string; name: string | null; email: string };
    responsibility: string;
    stream: { id: string; name: string; code: string } | null;
  }>;
}

interface PlacementPreview {
  class: { id: string; name: string; gradeLevel: string | null };
  academicYear: { id: string; name: string; label: string | null };
  streams: StreamOption[];
  unassigned: LearnerPlacement[];
  unassignedCount: number;
  totalLearners: number;
  strategy: string;
  seed: number | null;
  capacityViolations: string[];
  teacherAllocationWarnings: string[];
  summary: {
    totalStreams: number;
    totalLearners: number;
    assignedLearners: number;
    unassignedLearners: number;
  };
}

export default function PlacementsPage() {
  const { can } = useAuth();
  const canManage = can('placements.manage');

  const [academicYearId, setAcademicYearId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [gradeLevelFilter, setGradeLevelFilter] = React.useState('');

  const [showCreateStream, setShowCreateStream] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

  const [preview, setPreview] = React.useState<PlacementPreview | null>(null);
  const [assignments, setAssignments] = React.useState<Record<string, string | null>>({});

  const [streamName, setStreamName] = React.useState('');
  const [streamCode, setStreamCode] = React.useState('');
  const [streamCapacity, setStreamCapacity] = React.useState('');

  const sessions = useApi<{ sessions: AcademicSession[] }>('/api/academics/years');
  const classes = useApi<{
    classes: {
      id: string;
      name: string;
      gradeLevel: string | null;
      academicYearId: string | null;
      status: string;
    }[];
  }>(academicYearId ? `/api/classes?academicYearId=${academicYearId}` : '/api/classes');

  const activeClasses = React.useMemo(
    () => classes.data?.classes.filter((c) => c.status === 'active') ?? [],
    [classes.data]
  );

  const filteredClasses = React.useMemo(() => {
    return activeClasses.filter((c) => c.academicYearId === academicYearId);
  }, [academicYearId, activeClasses]);

  const gradeLevels = React.useMemo(() => {
    const levels = new Set(
      filteredClasses.map((c) => c.gradeLevel).filter((g): g is string => Boolean(g))
    );
    return Array.from(levels).sort();
  }, [filteredClasses]);

  const gradeFilteredClasses = React.useMemo(() => {
    if (!gradeLevelFilter) return filteredClasses;
    return filteredClasses.filter((c) => c.gradeLevel === gradeLevelFilter);
  }, [filteredClasses, gradeLevelFilter]);

  const viewData = useApi<ClassPlacementView>(
    academicYearId && classId ? `/api/placement/${classId}/${academicYearId}` : null
  );
  const view = viewData.data;

  const handleRandomDistribution = async () => {
    if (!academicYearId || !classId || !preview) return;

    const streamIds = preview.streams.map((s) => s.id);

    const response = await fetch(`/api/placement/${classId}/${academicYearId}/preview`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamIds,
        method: 'random',
        seed: Math.floor(Math.random() * 100000),
      }),
    });

    const data = await response.json();
    setPreview(data);
  };

  const handleBalancedDistribution = async () => {
    if (!academicYearId || !classId || !preview) return;

    const streamIds = preview.streams.map((s) => s.id);

    const response = await fetch(`/api/placement/${classId}/${academicYearId}/preview`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        streamIds,
        method: 'balanced',
      }),
    });

    const data = await response.json();
    setPreview(data);
  };

  const handleCreateStream = async () => {
    if (!academicYearId || !classId) return;

    const response = await fetch(`/api/placement/classes/${classId}/streams`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classId,
        academicYearId,
        name: streamName,
        code: streamCode,
        capacity: streamCapacity ? parseInt(streamCapacity) : undefined,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      setStreamName('');
      setStreamCode('');
      setStreamCapacity('');
      setShowCreateStream(false);

      if (preview) {
        const allStreamIds = [...preview.streams.map((s) => s.id), data.stream.id];
        const refreshResponse = await fetch(`/api/placement/${classId}/${academicYearId}/preview`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            streamIds: allStreamIds,
            method: 'balanced',
          }),
        });
        const refreshData = await refreshResponse.json();
        setPreview(refreshData);
      }
    } else {
      notify.error('Failed to create stream');
    }
  };

  const handleApply = async () => {
    if (!academicYearId || !classId || !preview) return;

    const response = await fetch(`/api/placement/${classId}/${academicYearId}/apply`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignments,
        strategy: 'manual',
        reason: 'Manual reorganization via placement UI',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      notify.success(`${data.placed} learner${data.placed !== 1 ? 's' : ''} placed successfully`);
      setShowConfirmDialog(false);
      setPreview(null);
    } else {
      const error = await response.json().catch(() => null);
      notify.error(error?.error?.message ?? 'Failed to apply placement');
    }
  };

  const activeStreams = React.useMemo(() => {
    if (!view) return [];
    return [...view.streams.filter((s) => (s.status ?? 'active') === 'active')].sort((a, b) =>
      a.code.localeCompare(b.code)
    );
  }, [view]);

  const allStreamOptions = React.useMemo(() => {
    if (!view) return [];
    return [
      {
        id: '',
        name: 'Unassigned',
        code: '—',
        capacity: null as number | null,
        learnerCount: 0,
        status: 'active',
      },
      ...activeStreams,
    ];
  }, [view, activeStreams]);

  const displayName = (l: LearnerPlacement): string => {
    return l.name ?? [l.firstName, l.lastName].filter(Boolean).join(' ') ?? l.email;
  };

  if (!canManage) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learner Placements" />
        <ErrorState
          title="You do not have permission"
          message="Placing learners requires placements.manage permission. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (!academicYearId || !classId) {
    const activeSessions = sessions.data?.sessions.filter((s) => s.status === 'active') ?? [];

    return (
      <div className="space-y-6">
        <SectionHeader title="Learner Placements" />
        <p className="text-sm text-muted-foreground">
          Reorganize learners within a class for the current session. This changes their stream
          assignment without affecting their permanent identity or historical records.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Field label="Academic Session">
              <Select
                value={academicYearId}
                onChange={(e) => {
                  setAcademicYearId(e.target.value);
                  setGradeLevelFilter('');
                  setClassId('');
                }}
              >
                <option value="">Select session…</option>
                {activeSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label ? `${s.name} - ${s.label}` : s.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {academicYearId && gradeLevels.length > 0 && (
            <div>
              <Field label="Grade Level">
                <Select
                  value={gradeLevelFilter}
                  onChange={(e) => {
                    setGradeLevelFilter(e.target.value);
                    setClassId('');
                  }}
                >
                  <option value="">All grades</option>
                  {gradeLevels.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <div>
            <Field label="Class">
              <Select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={!academicYearId}
              >
                <option value="">Select class…</option>
                {gradeFilteredClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.gradeLevel ? ` (${c.gradeLevel})` : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>
    );
  }

  if (!view && !preview) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learner Placements" />
        <LoadingState label="Loading placement view…" />
      </div>
    );
  }

  const unassignedLearners = view?.learners.filter((l) => !l.streamId) ?? [];

  const currentAssignments = React.useMemo(() => {
    if (!view) return {};
    const result: Record<string, string | null> = {};
    view.learners.forEach((l) => {
      result[l.userId] = l.streamId;
    });
    return result;
  }, [view]);

  const handleLearnerChange = (learnerId: string, newStreamId: string | null) => {
    setAssignments((prev) => ({
      ...prev,
      [learnerId]: newStreamId,
    }));
  };

  const hasChanges = React.useMemo(() => {
    if (!view || !preview) return false;
    return Object.entries(assignments).some(([id, streamId]) => {
      const current = currentAssignments[id];
      return current !== streamId;
    });
  }, [view, preview, assignments, currentAssignments]);

  const totalLearners = view?.learnerCounts.total ?? 0;
  const className = view?.class?.name ?? '...';
  const sessionName = view?.academicYear?.name ?? '...';

  const streamLearners = React.useMemo(() => {
    if (!view) return [];
    return view.learners
      .filter((l) => !l.streamId)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }, [view]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Learner Placements"
        description={`Reorganizing ${totalLearners} learners in ${className} for ${sessionName}`}
      />

      {preview && preview.capacityViolations.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">Capacity Warnings</p>
          <ul className="mt-2 list-disc space-y-1 text-sm text-amber-800">
            {preview.capacityViolations.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </Card>
      )}

      {preview && preview.teacherAllocationWarnings.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Teacher Allocation Warnings</p>
          <ul className="mt-2 list-disc space-y-1 text-sm text-blue-800">
            {preview.teacherAllocationWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRandomDistribution}
          disabled={!canManage || preview !== null}
        >
          Generate Preview
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBalancedDistribution}
          disabled={!canManage || preview !== null}
        >
          Balanced Distribution
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            const streamIds = allStreamOptions.filter((s) => s.id).map((s) => s.id);
            const totalUnassigned = view?.learnerCounts.unassigned ?? 0;
            if (view && streamIds.length > 0 && totalUnassigned > 0) {
              handleBalancedDistribution();
            }
          }}
          disabled={!canManage || !view}
        >
          Distribute Learners
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowCreateStream(true)}>
          Create Stream
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {allStreamOptions.map((stream) => {
          const streamLearners = view?.learners
            .filter(
              (learner): learner is LearnerPlacement =>
                learner.streamId === stream.id || (stream.id === '' && !learner.streamId)
            )
            .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

          return (
            <Card key={stream.id} className={stream.id === '' ? 'border-dashed' : ''}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      {stream.code === '—' ? 'Unassigned' : stream.code}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {stream.name}
                      {stream.capacity !== null ? ` (capacity: ${stream.capacity})` : ''}
                    </p>
                  </div>
                </div>

                {stream.id !== '' && (
                  <p className="text-xs text-muted-foreground mb-2">
                    {stream.learnerCount} learners currently assigned
                  </p>
                )}

                <div className="space-y-2">
                  {streamLearners && streamLearners.length > 0 ? (
                    streamLearners.map((learner) => {
                      const currentValue =
                        assignments[learner.userId] ?? currentAssignments[learner.userId];
                      return (
                        <div
                          key={learner.userId}
                          className="flex items-center gap-3 rounded-md border p-2"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {displayName(learner)}
                            </p>
                            <p className="text-xs text-muted-foreground">{learner.email}</p>
                          </div>
                          <Select
                            value={currentValue ?? ''}
                            onChange={(e) =>
                              handleLearnerChange(learner.userId, e.target.value || null)
                            }
                            className="w-36 text-xs"
                          >
                            <option value="">—</option>
                            {allStreamOptions.map((s) => (
                              <option key={s.id || '__unassigned__'} value={s.id}>
                                {s.code}
                              </option>
                            ))}
                          </Select>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted-foreground">No learners assigned</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {hasChanges && (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setAssignments(currentAssignments)}>
            Reset Changes
          </Button>
          <Button onClick={() => setShowConfirmDialog(true)}>Confirm Changes</Button>
        </div>
      )}

      <Modal
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        title="Review Placement Changes"
      >
        <div className="space-y-4 max-h-60 overflow-y-auto">
          {Object.entries(assignments)
            .filter(([id, streamId]) => {
              const current = currentAssignments[id];
              return current !== streamId;
            })
            .map(([learnerId, newStreamId]) => {
              const learner = view?.learners.find((l) => l.userId === learnerId);
              const newStream = allStreamOptions.find((s) => s.id === newStreamId);
              const oldStream = activeStreams.find((s) => s.id === learner?.streamId);
              return (
                <div key={learnerId} className="flex justify-between text-sm">
                  <span>{displayName(learner!)}</span>
                  <span className="text-muted-foreground">
                    {oldStream?.code ?? 'unassigned'} → {newStream?.code ?? 'unassigned'}
                  </span>
                </div>
              );
            })}
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="ghost" onClick={() => setShowConfirmDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply Changes</Button>
        </div>
      </Modal>

      <Modal
        isOpen={showCreateStream}
        onClose={() => setShowCreateStream(false)}
        title="Create New Stream"
      >
        <div className="space-y-4">
          <Field label="Stream Name">
            <TextInput
              value={streamName}
              onChange={(e) => setStreamName(e.target.value)}
              placeholder="e.g., Stream Alpha"
            />
          </Field>
          <Field label="Stream Code">
            <TextInput
              value={streamCode}
              onChange={(e) => setStreamCode(e.target.value)}
              placeholder="e.g., A"
            />
          </Field>
          <Field label="Capacity (optional)">
            <TextInput
              value={streamCapacity}
              onChange={(e) => setStreamCapacity(e.target.value)}
              placeholder="Maximum learners"
              type="number"
            />
          </Field>
        </div>

        <div className="flex gap-2 justify-end pt-4">
          <Button variant="ghost" onClick={() => setShowCreateStream(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateStream}>Create Stream</Button>
        </div>
      </Modal>
    </div>
  );
}
