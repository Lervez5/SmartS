'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Grading - teacher portal.
 *
 * A teacher's results screen, not the school's grading configuration. The
 * scales, bands and rules live in the admin Grading page and the GRADING module;
 * this screen reads them and writes marks.
 *
 * Same `results-entry` API the admin uses, including the same server-side
 * authorization: the roster is the class enrolment, the learning areas are the
 * ones the selected assessment covers, and entry is gated on the teaching
 * allocation rather than on the role. A class teacher reaches every learning
 * area in their class (see `entersAllResults`); a learning-area teacher reaches
 * the ones they are allocated to.
 *
 * Locked assessments are read-only rather than silently frozen: the API refuses
 * to change a completed assessment, so this screen shows values instead of
 * editable inputs that would fail on submission.
 */

/** One cell of the grid, as the API returns it. */
interface GridCell {
  subjectId: string;
  score: number | null;
  competencyLevel: string | null;
  racefieldBand: string | null;
  savedAt: string | null;
}

interface GridResponse {
  assessment: {
    id: string;
    title: string;
    status: string;
    assessmentType: string | null;
    maxScore: number | null;
    className: string | null;
    gradeLevel: string | null;
    termNumber: number | null;
    sessionName: string | null;
  };
  learningAreas: Array<{ id: string; name: string; code: string | null }>;
  locked: boolean;
  rows: Array<{
    learner: {
      id: string;
      name: string | null;
      gradeLevel: string | null;
      stream: { id: string; name: string; code: string } | null;
    };
    cells: GridCell[];
  }>;
  summary: {
    learners: number;
    learningAreas: number;
    cells: number;
    recorded: number;
  };
}

interface ContextResponse {
  sessions: Array<{
    id: string;
    name: string;
    label: string | null;
    status: string;
    terms: Array<{ id: string; name: string; termNumber: number | null }>;
  }>;
  assessments: Array<{
    id: string;
    title: string;
    assessmentType: string | null;
    status: string;
    maxScore: number | null;
    classId: string;
    className: string | null;
    gradeLevel: string | null;
    learningAreaCount: number;
    learningAreaNames: string[];
  }>;
}

/** A learner row, with the in-progress edits layered over what is saved. */
interface RosterRow {
  learner: GridResponse['rows'][number]['learner'];
  /** Draft input value per learning area, keyed by subject id. */
  edits: Record<string, string>;
  /** The saved value per learning area, keyed by subject id. */
  saved: Record<string, GridCell>;
  recorded: number;
}

export default function TeacherGradingPage() {
  const { can } = useAuth();

  const [assessmentId, setAssessmentId] = React.useState('');
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const context = useApi<ContextResponse>(
    can('examinations.view') ? '/api/results-entry/context' : null
  );

  const assessments = context.data?.assessments ?? [];
  const selected = assessments.find((a) => a.id === assessmentId) ?? null;

  // The grid is per assessment, and the class comes from the assessment itself:
  // a teacher picks a paper, and the roster is that paper's class.
  const grid = useApi<GridResponse>(
    can('examinations.view') && assessmentId && selected
      ? `/api/results-entry/${assessmentId}?classId=${selected.classId}`
      : null
  );

  // An assessment removed from the school while it is open would otherwise
  // leave a stale id selected.
  React.useEffect(() => {
    if (assessmentId && !assessments.some((a) => a.id === assessmentId)) {
      setAssessmentId('');
    }
  }, [assessments, assessmentId]);

  const areas = grid.data?.learningAreas ?? [];
  const locked = grid.data?.locked ?? false;
  const maxScore = grid.data?.assessment.maxScore ?? null;

  const rows: RosterRow[] = React.useMemo(() => {
    if (!grid.data) return [];
    return grid.data.rows.map((row) => {
      const saved: Record<string, GridCell> = {};
      for (const cell of row.cells) saved[cell.subjectId] = cell;
      const recorded = row.cells.filter((cell) => cell.score !== null).length;
      return { learner: row.learner, edits, saved, recorded };
    });
  }, [grid.data, edits]);

  const draftCount = Object.keys(edits).length;

  function setEdit(learnerId: string, subjectId: string, raw: string) {
    setEdits((prev) => ({ ...prev, [`${learnerId}:${subjectId}`]: raw }));
  }

  async function save() {
    if (!grid.data) return;

    const results: Array<{ studentId: string; subjectId: string; score: number | null }> = [];
    // The class is the one the assessment is set against, taken from the context
    // rather than the grid: the grid does not repeat it.
    const classId = selected?.classId ?? '';
    for (const row of grid.data.rows) {
      for (const area of areas) {
        const key = `${row.learner.id}:${area.id}`;
        const edited = edits[key];
        if (edited === undefined) continue; // untouched
        const trimmed = edited.trim();
        // An emptied field clears the mark rather than being read as zero.
        results.push({
          studentId: row.learner.id,
          subjectId: area.id,
          score: trimmed === '' ? null : Number(trimmed),
        });
      }
    }

    if (results.length === 0) {
      notify.error('Nothing has changed yet.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/results-entry/${assessmentId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, results }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Saving failed (HTTP ${res.status}).`);
        return;
      }
      const body = (await res.json()) as { saved?: number; cleared?: number };
      const parts: string[] = [];
      if (body.saved) parts.push(`${body.saved} saved`);
      if (body.cleared) parts.push(`${body.cleared} cleared`);
      notify.success(`Results updated${parts.length ? ` — ${parts.join(', ')}` : ''}.`);
      setEdits({});
      grid.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<DataTableColumn<RosterRow>> = React.useMemo(() => {
    const base: Array<DataTableColumn<RosterRow>> = [
      {
        id: 'learner',
        header: 'Learner',
        cell: (row) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {row.learner.name ?? 'Unnamed learner'}
            </p>
            {row.learner.stream ? (
              <p className="truncate text-xs text-muted-foreground">
                {row.learner.stream.name} ({row.learner.stream.code})
              </p>
            ) : null}
          </div>
        ),
        sortValue: (row) => row.learner.name ?? '',
      },
      {
        id: 'recorded',
        header: 'Recorded',
        align: 'right',
        hideBelow: 'md',
        cell: (row) => (
          <span className="text-sm text-muted-foreground">
            {row.recorded}/{areas.length}
          </span>
        ),
        sortValue: (row) => row.recorded,
      },
    ];

    for (const area of areas) {
      base.push({
        id: `area-${area.id}`,
        header: area.code ? `${area.name} (${area.code})` : area.name,
        align: 'right',
        cell: (row) => {
          const saved = row.saved[area.id];
          if (locked) {
            // The assessment is settled, so this is a value rather than an input:
            // a field that would be refused on submission is not a form.
            return (
              <span className="text-sm text-foreground">
                {saved && saved.score !== null ? (
                  saved.score
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </span>
            );
          }
          const key = `${row.learner.id}:${area.id}`;
          const current = edits[key] ?? (saved && saved.score !== null ? String(saved.score) : '');
          return (
            <TextInput
              type="number"
              min={0}
              max={maxScore ?? undefined}
              value={current}
              onChange={(e) => setEdit(row.learner.id, area.id, e.target.value)}
              className="h-9 w-20 text-right"
              inputMode="decimal"
            />
          );
        },
      });
    }
    return base;
    // `edits` is read through the closure of each cell, so the columns are
    // rebuilt whenever an edit changes; `locked` and the assessment are stable.
  }, [areas, edits, locked, maxScore]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Grading"
        description="Enter and review learner results for the assessments you are assigned to. Grading rules and scales are managed centrally."
      />

      {context.error ? (
        <ErrorState
          title="Could not load results context"
          message="GET /api/results-entry/context requires examinations.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : assessments.length === 0 ? (
        <EmptyState
          title="No assessments available"
          description="Assessments appear here once your school creates them for the classes you teach."
          icon="list"
          action={
            <Button variant="outline" onClick={() => context.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <>
          <Field label="Assessment">
            <Select
              value={assessmentId}
              onChange={(e) => {
                setAssessmentId(e.target.value);
                setEdits({});
              }}
            >
              <option value="">Select an assessment…</option>
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.title}
                  {assessment.className ? ` — ${assessment.className}` : ''} ·{' '}
                  {assessment.learningAreaCount} learning area
                  {assessment.learningAreaCount === 1 ? '' : 's'} · {assessment.status}
                </option>
              ))}
            </Select>
          </Field>

          {!assessmentId ? (
            <EmptyState
              title="Choose an assessment"
              description="Pick a paper above to see its roster and learning areas."
              icon="list"
            />
          ) : grid.loading ? (
            <LoadingState label="Loading the results grid" />
          ) : grid.error ? (
            <ErrorState
              title="Could not load the results grid"
              message="You may hold no teaching allocation for this assessment's class, or the class does not match the assessment."
            />
          ) : grid.data ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">
                    {grid.data.assessment.title}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {grid.data.assessment.className ?? 'No class'} · {grid.data.summary.learners}{' '}
                    learner
                    {grid.data.summary.learners === 1 ? '' : 's'} ·{' '}
                    {grid.data.summary.learningAreas} learning area
                    {grid.data.summary.learningAreas === 1 ? '' : 's'} ·{' '}
                    {grid.data.summary.recorded} of {grid.data.summary.cells} marks recorded
                  </p>
                </div>
                {locked ? (
                  <StatusPill label="Read-only — assessment locked" tone="warning" />
                ) : (
                  <Button onClick={save} disabled={busy || draftCount === 0}>
                    {busy
                      ? 'Saving…'
                      : draftCount === 0
                        ? 'Nothing to save'
                        : `Save ${draftCount} change${draftCount === 1 ? '' : 's'}`}
                  </Button>
                )}
              </div>

              {locked ? (
                <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  This assessment is complete, so its results are locked. Reopen it to enter marks.
                </p>
              ) : null}

              <DataTable
                caption="Results by learner and learning area"
                columns={columns}
                rows={rows}
                rowKey={(row) => row.learner.id}
                pageSize={rows.length > 15 ? 15 : 0}
                empty={
                  <EmptyState
                    title="No learners enrolled"
                    description="This class has no learners enrolled, so there is nothing to grade."
                    icon="users-round"
                  />
                }
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
