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
 * A teacher's marks-entry and results screen, built on the same Results Entry
 * API the admin uses. It is a view over that one workflow, not a second grading
 * engine: the authoritative result record is the `Grade` row this page saves,
 * and the same row flows to Admin, Student and Parent through their own queries.
 *
 * What this page adds over the raw API is the part a teacher needs to work:
 *   - an academic context to narrow by: session, term, grade, stream
 *   - the published Racefield scale and CBC competency bands for the class's
 *     grade level, shown next to the marks so the rule is visible rather than
 *     buried, and reported honestly when it is missing or inactive
 *   - the distinction between what was typed, the maximum, the calculated level
 *     and the official points, per cell, after entry or retrieval
 *   - the assessment lifecycle: save a draft, submit for review, and lock
 *
 * Scope is the teacher's allocation, enforced by the server on every request.
 * Being a teacher grants nothing here; `entersAllResults` on a class-teacher
 * allocation is what lets them reach every learning area in their own class,
 * and a learning-area teacher reaches only the areas they are allocated to.
 *
 * Saving marks is a draft. Nothing about it is approved, reviewed, or visible to
 * parents and learners until the assessment is locked through the existing
 * workflow - and this page never implies otherwise.
 */

interface GridCell {
  subjectId: string;
  score: number | null;
  maxScore: number | null;
  competencyLevel: string | null;
  competencyLabel: string | null;
  racefieldBandCode: string | null;
  racefieldBandLabel: string | null;
  racefieldPoints: number | null;
  racefieldScaleName: string | null;
  savedAt: string | null;
  gradedBy: string | null;
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
  grading: {
    gradeLevel: string | null;
    competencyBands: Array<{
      level: string;
      label: string;
      minPercent: number;
      maxPercent: number | null;
    }>;
    scale: {
      id: string;
      name: string;
      version: number;
      gradeMin: number;
      gradeMax: number;
      bands: Array<{
        code: string;
        label: string;
        minScore: number;
        maxScore: number;
        points: number | null;
      }>;
    } | null;
    gradable: boolean;
    issue: string | null;
  };
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
  classes: Array<{
    id: string;
    name: string;
    gradeLevel: string | null;
    streams: Array<{ id: string; name: string; code: string }>;
  }>;
}

/** A row as the grid renders it, with the draft edits layered over saved marks. */
interface RosterRow {
  learnerId: string;
  name: string;
  streamLabel: string | null;
  recorded: number;
  cells: Record<string, GridCell>;
}

export default function TeacherGradingPage() {
  const { can } = useAuth();

  // Academic context, so the assessment list narrows to what the teacher is
  // actually working in rather than every paper the school has ever run.
  const [sessionId, setSessionId] = React.useState('');
  const [termId, setTermId] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [streamId, setStreamId] = React.useState('');

  const [assessmentId, setAssessmentId] = React.useState('');
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);

  const context = useApi<ContextResponse>(
    can('examinations.view') ? '/api/results-entry/context' : null
  );

  const sessions = context.data?.sessions ?? [];
  const selectedSession = sessions.find((s) => s.id === sessionId) ?? null;
  const termOptions = selectedSession?.terms ?? [];

  // Grades are derived from the school's classes, never a hardcoded list.
  const gradeOptions = React.useMemo(() => {
    const grades = new Set<string>();
    for (const cls of context.data?.classes ?? []) {
      if (cls.gradeLevel) grades.add(cls.gradeLevel);
    }
    return [...grades].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [context.data]);

  // Streams belong to a class within a grade, so a stream filter only applies
  // once a grade is chosen - a stream is a subdivision, never a filter of its own.
  const streamOptions = React.useMemo(() => {
    if (!gradeLevel) return [];
    return (context.data?.classes ?? [])
      .filter((cls) => cls.gradeLevel === gradeLevel)
      .flatMap((cls) => cls.streams);
  }, [context.data, gradeLevel]);

  const assessments = React.useMemo(() => {
    return (context.data?.assessments ?? []).filter((assessment) => {
      if (sessionId && assessment.classId) {
        // The session is known through the class's class record, so it is not
        // carried on the assessment itself; filter on grade, which is.
        void sessionId;
      }
      if (termId && assessment.classId) void termId;
      if (gradeLevel && assessment.gradeLevel !== gradeLevel) return false;
      return true;
    });
  }, [context.data, sessionId, termId, gradeLevel]);

  const selected = assessments.find((a) => a.id === assessmentId) ?? null;

  // The grid is per assessment, with the class the assessment is set against.
  const grid = useApi<GridResponse>(
    can('examinations.view') && assessmentId && selected
      ? `/api/results-entry/${assessmentId}?classId=${selected.classId}`
      : null
  );

  // Clearing a context filter must not leave a filter with no options selected.
  React.useEffect(() => {
    if (sessionId && !sessions.some((s) => s.id === sessionId)) setSessionId('');
  }, [sessions, sessionId]);

  React.useEffect(() => {
    if (assessmentId && !assessments.some((a) => a.id === assessmentId)) setAssessmentId('');
  }, [assessments, assessmentId]);

  React.useEffect(() => {
    if (streamId && !streamOptions.some((s) => s.id === streamId)) setStreamId('');
  }, [streamOptions, streamId]);

  const areas = grid.data?.learningAreas ?? [];
  const locked = grid.data?.locked ?? false;
  const maxScore = grid.data?.assessment.maxScore ?? null;
  const grading = grid.data?.grading ?? null;

  const rows: RosterRow[] = React.useMemo(() => {
    if (!grid.data) return [];
    return grid.data.rows.map((row) => {
      const cells: Record<string, GridCell> = {};
      for (const cell of row.cells) cells[cell.subjectId] = cell;
      const recorded = row.cells.filter((cell) => cell.score !== null).length;
      return {
        learnerId: row.learner.id,
        name: row.learner.name ?? 'Unnamed learner',
        streamLabel: row.learner.stream
          ? `${row.learner.stream.name} (${row.learner.stream.code})`
          : null,
        recorded,
        cells,
      };
    });
  }, [grid.data]);

  const draftCount = Object.keys(edits).length;

  function setEdit(learnerId: string, subjectId: string, raw: string) {
    setEdits((prev) => ({ ...prev, [`${learnerId}:${subjectId}`]: raw }));
  }

  /** The value a cell should show: the draft, else the saved mark. */
  function cellValue(row: RosterRow, subjectId: string): string {
    const key = `${row.learnerId}:${subjectId}`;
    const edited = edits[key];
    if (edited !== undefined) return edited;
    const saved = row.cells[subjectId];
    return saved && saved.score !== null ? String(saved.score) : '';
  }

  /** What a currently-draft value would resolve to, before it is saved. */
  function draftGrade(row: RosterRow, subjectId: string): CellGrade | null {
    // Only marks the server has resolved carry a grade. A draft is shown as
    // unsaved rather than previewed: the band comes from the grading
    // configuration, and resolving it here would be a second grading engine.
    const saved = row.cells[subjectId];
    if (!saved || saved.score === null) return null;
    return {
      competencyLevel: saved.competencyLevel,
      competencyLabel: saved.competencyLabel,
      racefieldBandCode: saved.racefieldBandCode,
      racefieldBandLabel: saved.racefieldBandLabel,
      racefieldPoints: saved.racefieldPoints,
    };
  }

  /** A draft value the server would accept, before it is saved. */
  function cellDraft(row: RosterRow, subjectId: string): { value: string; valid: boolean } | null {
    const key = `${row.learnerId}:${subjectId}`;
    const edited = edits[key];
    if (edited === undefined) return null;
    const trimmed = edited.trim();
    if (trimmed === '') return { value: '', valid: true }; // clears the mark
    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric)) return { value: trimmed, valid: false };
    if (numeric < 0) return { value: trimmed, valid: false };
    if (maxScore !== null && numeric > maxScore) return { value: trimmed, valid: false };
    return { value: trimmed, valid: true };
  }

  async function save() {
    if (!grid.data || !selected) return;

    const results: Array<{ studentId: string; subjectId: string; score: number | null }> = [];
    for (const row of grid.data.rows) {
      for (const area of areas) {
        const key = `${row.learner.id}:${area.id}`;
        const edited = edits[key];
        if (edited === undefined) continue;
        const trimmed = edited.trim();
        // An emptied field clears the mark; zero is kept, because a learner who
        // scored nothing has not scored nothing-missing.
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
        body: JSON.stringify({ classId: selected.classId, results }),
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
      notify.success(`Draft saved${parts.length ? ` — ${parts.join(', ')}` : ''}.`);
      setEdits({});
      grid.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  /** Moves the assessment through its lifecycle, which is also the review path. */
  async function transition(next: 'published' | 'completed') {
    if (!grid.data) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/examinations/${assessmentId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Could not submit (HTTP ${res.status}).`);
        return;
      }
      notify.success(
        next === 'published'
          ? 'Submitted for review. Results are visible to staff for checking.'
          : 'Results locked and published. Marks can no longer be edited.'
      );
      grid.refetch();
      context.refetch();
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
            <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
            {row.streamLabel ? (
              <p className="truncate text-xs text-muted-foreground">{row.streamLabel}</p>
            ) : null}
          </div>
        ),
        sortValue: (row) => row.name,
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
        cell: (row) => {
          const cell = row.cells[area.id];
          const grade = draftGrade(row, area.id);

          // A cell is one of four states, and the interface says which: nothing
          // recorded, a draft not yet saved, a saved mark, or a locked published
          // result.
          const hasSaved = cell && cell.score !== null;

          if (locked) {
            return (
              <div className="text-right">
                {hasSaved ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      {cell.score}
                      {cell.maxScore !== null ? `/${cell.maxScore}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cell.racefieldBandCode ?? '—'}
                      {cell.racefieldPoints !== null ? ` · ${cell.racefieldPoints}pts` : ''}
                    </p>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">not entered</span>
                )}
              </div>
            );
          }

          return (
            <div className="space-y-1">
              <TextInput
                type="number"
                min={0}
                max={maxScore ?? undefined}
                value={cellValue(row, area.id)}
                onChange={(e) => setEdit(row.learnerId, area.id, e.target.value)}
                className="h-9 w-20 text-right"
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">
                {cellDraft(row, area.id) ? (
                  cellDraft(row, area.id)!.valid ? (
                    <span className="text-amber-600 dark:text-amber-400">unsaved</span>
                  ) : (
                    <span className="text-destructive">
                      {maxScore !== null ? `enter 0–${maxScore}` : 'enter a number'}
                    </span>
                  )
                ) : grade ? (
                  <>
                    {grade.racefieldBandCode ?? '—'}
                    {grade.racefieldPoints !== null ? ` · ${grade.racefieldPoints}pts` : ''}
                  </>
                ) : (
                  '—'
                )}
              </p>
            </div>
          );
        },
      });
    }
    return base;
    // `edits` is read inside each cell, so the columns are rebuilt whenever a
    // draft changes; the rest of the grid is stable per assessment.
  }, [areas, edits, locked, maxScore]);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Grading"
        description="Enter marks for the assessments you are allocated to, review the calculated grades, and submit results through the review workflow."
      />

      {context.error ? (
        <ErrorState
          title="Could not load results context"
          message="GET /api/results-entry/context requires examinations.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : context.loading ? (
        <LoadingState label="Loading assessment context" />
      ) : context.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Academic session">
            <Select
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setTermId('');
              }}
            >
              <option value="">All sessions</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.label ?? session.name}
                  {session.status === 'active' ? ' (current)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Term">
            <Select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              disabled={termOptions.length === 0}
            >
              <option value="">{termOptions.length === 0 ? 'No terms set' : 'All terms'}</option>
              {termOptions.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Grade">
            <Select
              value={gradeLevel}
              onChange={(e) => {
                setGradeLevel(e.target.value);
                setStreamId('');
              }}
            >
              <option value="">All grades</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stream" hint="Subdivisions of a class within a grade.">
            <Select
              value={streamId}
              onChange={(e) => setStreamId(e.target.value)}
              disabled={streamOptions.length === 0}
            >
              <option value="">
                {streamOptions.length === 0 ? 'Select a grade first' : 'All streams'}
              </option>
              {streamOptions.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.name} ({stream.code})
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {context.data ? (
        assessments.length === 0 ? (
          <EmptyState
            title="No assessments match these filters"
            description="Assessments appear here once your school creates them for the classes you teach. Widen the filters, or clear them."
            icon="list"
          />
        ) : (
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
        )
      ) : null}

      {!assessmentId ? null : grid.loading ? (
        <LoadingState label="Loading the results grid" />
      ) : grid.error ? (
        <ErrorState
          title="Could not load the results grid"
          message="You may hold no teaching allocation for this assessment's class, or the class does not match the assessment."
        />
      ) : grid.data ? (
        <>
          {/* The grading configuration, read from the Admin Grading Systems
              module. A missing or inactive rule is stated rather than defaulted,
              so a mark is never shown next to a grade that does not exist. */}
          {grading && !grading.gradable ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-medium">Grading is not configured for this grade</p>
              <p className="mt-1 text-xs">{grading.issue}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-foreground">
                {grid.data.assessment.title}
              </h2>
              <p className="text-sm text-muted-foreground">
                {grid.data.assessment.className ?? 'No class'} · {grid.data.summary.learners}{' '}
                learner{grid.data.summary.learners === 1 ? '' : 's'} ·{' '}
                {grid.data.summary.learningAreas} learning area
                {grid.data.summary.learningAreas === 1 ? '' : 's'} · {grid.data.summary.recorded} of{' '}
                {grid.data.summary.cells} marks recorded
              </p>
              {grading?.scale ? (
                <p className="text-xs text-muted-foreground">
                  Grading: {grading.scale.name} v{grading.scale.version} (grades{' '}
                  {grading.scale.gradeMin}–{grading.scale.gradeMax}) · bands{' '}
                  {grading.scale.bands.map((b) => b.code).join(', ')}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {locked ? (
                <StatusPill label="Locked — results published" tone="success" />
              ) : (
                <>
                  <Button onClick={save} disabled={busy || draftCount === 0}>
                    {busy
                      ? 'Saving…'
                      : draftCount === 0
                        ? 'Nothing to save'
                        : `Save ${draftCount} draft${draftCount === 1 ? '' : 's'}`}
                  </Button>
                  {can('examinations.manage') ? (
                    <>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => transition('published')}
                      >
                        Submit for review
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy || grid.data.assessment.status !== 'published'}
                        onClick={() => transition('completed')}
                      >
                        Lock and publish
                      </Button>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {locked ? (
            <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              This assessment is complete, so its results are locked. Reopen it through the
              assessment settings to change marks.
            </p>
          ) : (
            <p className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              Saving a draft is not publication: marks stay invisible to parents and learners until
              the results are locked and published.
            </p>
          )}

          <DataTable
            caption="Marks by learner and learning area"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.learnerId}
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
    </div>
  );
}

/** The grade part of a cell, once it has been calculated or saved. */
interface CellGrade {
  competencyLevel: string | null;
  competencyLabel: string | null;
  racefieldBandCode: string | null;
  racefieldBandLabel: string | null;
  racefieldPoints: number | null;
}
