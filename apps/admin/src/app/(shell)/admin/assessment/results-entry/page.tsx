'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  StatusPill,
  notify,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Results Entry - enter learner summative results by learning area.
 *
 * The context is chosen first, in the order it constrains: an academic session
 * and term decide which assessments exist, a grade narrows them further, and an
 * assessment fixes the class and the learning areas. Dependent controls reset
 * when the context above them changes, so marks cannot be entered against the
 * wrong assessment or the wrong learners.
 *
 * "Out of" is shown from the assessment's configured maximum and is not editable
 * here - it is the assessment's own value, and the API rejects any score above
 * it.
 *
 * The grid is learners × learning areas, which is what `Grade` already records.
 * Saving upserts on learner, learning area and assessment, so an edited result is
 * updated rather than duplicated.
 */
interface TermOption {
  id: string;
  name: string;
  termNumber: number;
}

interface SessionOption {
  id: string;
  name: string;
  label: string;
  status: string;
  terms: TermOption[];
}

interface AssessmentOption {
  id: string;
  title: string;
  assessmentType: string | null;
  status: string;
  maxScore: number | null;
  classId: string | null;
  className: string | null;
  gradeLevel: string | null;
  learningAreaCount: number;
  learningAreaNames: string[];
}

interface ClassOption {
  id: string;
  name: string;
  gradeLevel: string | null;
  streams: Array<{ id: string; name: string; code: string }>;
}

interface ContextResponse {
  sessions?: SessionOption[];
  assessments?: AssessmentOption[];
  classes?: ClassOption[];
  gradeLevels?: string[];
}

interface Cell {
  subjectId: string;
  score: number | null;
  competencyLevel: string | null;
  savedAt: string | null;
}

interface GridRow {
  learner: {
    id: string;
    name: string;
    gradeLevel: string | null;
    stream: { id: string; name: string; code: string } | null;
  };
  cells: Cell[];
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
  rows: GridRow[];
  summary: { learners: number; learningAreas: number; cells: number; recorded: number };
}

export default function AdminResultsEntryPage() {
  const { can } = useAuth();
  const allowed = can('grading.manage');

  // Context. Changing anything above resets what depends on it, so a stale
  // assessment can never be scored against a different class.
  const [sessionId, setSessionId] = React.useState('');
  const [termId, setTermId] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [assessmentId, setAssessmentId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [streamId, setStreamId] = React.useState('');

  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [hydratedFor, setHydratedFor] = React.useState<string | null>(null);

  const contextParams = new URLSearchParams();
  if (sessionId) contextParams.set('academicYearId', sessionId);
  if (termId) contextParams.set('termId', termId);
  if (gradeLevel) contextParams.set('gradeLevel', gradeLevel);
  const cq = contextParams.toString();

  const context = useApi<ContextResponse>(
    allowed
      ? `/api/results-entry/context${cq ? `?${cq}` : ''}`
      : '/api/results-entry/context?denied=1'
  );

  // The grid only loads once an assessment is chosen.
  const gridParams = new URLSearchParams();
  if (classId) gridParams.set('classId', classId);
  if (streamId) gridParams.set('streamId', streamId);
  const gq = gridParams.toString();

  const grid = useApi<GridResponse>(
    allowed && assessmentId && classId
      ? `/api/results-entry/${assessmentId}${gq ? `?${gq}` : ''}`
      : null
  );

  const sessions = context.data?.sessions ?? [];
  const assessments = context.data?.assessments ?? [];
  const classes = context.data?.classes ?? [];

  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const assessment = assessments.find((a) => a.id === assessmentId) ?? null;
  const parentClass = classes.find((c) => c.id === classId) ?? null;

  // The class is fixed by the assessment, so it is shown rather than chosen
  // independently - a mismatch would record marks against the wrong learners.
  const effectiveClassId = assessment?.classId ?? '';

  // Term needs a session before it can be meaningful.
  const terms = session?.terms ?? [];

  function resetFromAssessment() {
    setStreamId('');
    setDraft({});
    setHydratedFor(null);
  }

  const gridKey = `${assessmentId}:${effectiveClassId}:${streamId}`;
  React.useEffect(() => {
    if (!grid.data || hydratedFor === gridKey) return;
    const seeded: Record<string, string> = {};
    for (const row of grid.data.rows) {
      for (const cell of row.cells) {
        seeded[`${row.learner.id}:${cell.subjectId}`] =
          cell.score === null ? '' : String(cell.score);
      }
    }
    setDraft(seeded);
    setHydratedFor(gridKey);
  }, [grid.data, hydratedFor, gridKey]);

  const dirty = React.useMemo(() => {
    if (!grid.data) return false;
    for (const row of grid.data.rows) {
      for (const cell of row.cells) {
        const key = `${row.learner.id}:${cell.subjectId}`;
        const original = cell.score === null ? '' : String(cell.score);
        if ((draft[key] ?? '') !== original) return true;
      }
    }
    return false;
  }, [grid.data, draft]);

  async function save() {
    if (!grid.data) return;
    const results: Array<{ studentId: string; subjectId: string; score: number | null }> = [];

    for (const row of grid.data.rows) {
      for (const cell of row.cells) {
        const key = `${row.learner.id}:${cell.subjectId}`;
        const raw = (draft[key] ?? '').trim();
        if (raw === '') {
          results.push({ studentId: row.learner.id, subjectId: cell.subjectId, score: null });
          continue;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          notify.error(`"${raw}" is not a number.`);
          return;
        }
        results.push({ studentId: row.learner.id, subjectId: cell.subjectId, score: parsed });
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/results-entry/${assessmentId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: effectiveClassId, results }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Could not save results (HTTP ${res.status}).`);
        return;
      }

      const body = (await res.json()) as { saved: number; cleared: number };
      notify.success(
        `${body.saved} result${body.saved === 1 ? '' : 's'} saved${
          body.cleared ? `, ${body.cleared} cleared` : ''
        }.`
      );
      grid.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  const gridRows = grid.data?.rows ?? [];
  const areas = grid.data?.learningAreas ?? [];
  const max = grid.data?.assessment.maxScore ?? null;

  const learnerColumns: Array<DataTableColumn<GridRow>> = [
    {
      id: 'learner',
      header: 'Learner',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.learner.name}</p>
          {/* A stream is a subdivision of the class, shown to make the
              relationship visible rather than implied. */}
          {row.learner.stream ? (
            <p className="truncate text-xs text-muted-foreground">
              Stream {row.learner.stream.name}
            </p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">No stream</p>
          )}
        </div>
      ),
      sortValue: (row) => row.learner.name,
    },
    ...areas.map((area) => ({
      id: area.id,
      header: area.name,
      cell: (row: GridRow) => {
        const key = `${row.learner.id}:${area.id}`;
        const value = draft[key] ?? '';
        const recorded = row.cells.find((cell) => cell.subjectId === area.id);
        const over = value !== '' && max !== null && Number(value) > max;

        return (
          <div className="flex flex-col items-end gap-1">
            <input
              type="number"
              min={0}
              max={max ?? undefined}
              step="any"
              disabled={grid.data?.locked}
              value={value}
              onChange={(event) => {
                setDraft((prev) => ({ ...prev, [key]: event.target.value }));
                setHydratedFor(gridKey);
              }}
              aria-label={`${area.name} mark for ${row.learner.name}`}
              className={[
                'h-9 w-20 rounded-md border bg-background px-2 text-right text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                over ? 'border-destructive ring-1 ring-destructive' : 'border-input',
                recorded?.score !== null && recorded?.score !== undefined && !dirty
                  ? 'bg-muted/40'
                  : '',
              ].join(' ')}
            />
            {over ? (
              <span className="text-[11px] font-medium text-destructive">Max {max}</span>
            ) : recorded?.competencyLevel ? (
              <span className="text-[11px] text-muted-foreground">{recorded.competencyLevel}</span>
            ) : null}
          </div>
        );
      },
    })),
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Results Entry" />
        <ErrorState
          title="You do not have access to enter results"
          message="Entering results requires grading.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Results Entry"
        description="Choose an assessment context, then enter learner scores by learning area."
        action={
          assessment && !grid.data?.locked ? (
            <div className="flex items-center gap-2">
              {dirty ? (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Unsaved changes
                </span>
              ) : null}
              <button
                type="button"
                onClick={save}
                disabled={saving || !dirty}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save results'}
              </button>
            </div>
          ) : null
        }
      />

      {/* Assessment context. Order matters: each control constrains the next,
          and changing one resets what depends on it. */}
      <div className="grid grid-cols-1 gap-5 rounded-lg border bg-card p-5 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Term" hint={session ? undefined : 'Choose a session first'}>
          <select
            value={termId}
            disabled={!session}
            onChange={(event) => {
              setTermId(event.target.value);
              setAssessmentId('');
              setClassId('');
              resetFromAssessment();
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{session ? 'All terms' : 'Select a session first'}</option>
            {terms.map((term) => (
              <option key={term.id} value={term.id}>
                Term {term.termNumber}
                {term.name && term.name !== `Term ${term.termNumber}` ? ` · ${term.name}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Grade">
          <select
            value={gradeLevel}
            onChange={(event) => {
              setGradeLevel(event.target.value);
              setAssessmentId('');
              setClassId('');
              resetFromAssessment();
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All grades</option>
            {(context.data?.gradeLevels ?? []).map((grade) => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Assessment"
          hint={assessments.length === 0 ? 'No assessments in this context' : undefined}
        >
          <select
            value={assessmentId}
            disabled={assessments.length === 0}
            onChange={(event) => {
              setAssessmentId(event.target.value);
              setStreamId('');
              setDraft({});
              setHydratedFor(null);
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Select assessment…</option>
            {assessments.map((item) => (
              <option key={item.id} value={item.id}>
                {[item.title, item.assessmentType].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Class"
          hint={assessment ? 'Set by the assessment' : 'Select an assessment first'}
        >
          <select
            value={effectiveClassId}
            disabled={!assessment}
            onChange={(event) => {
              setClassId(event.target.value);
              resetFromAssessment();
            }}
            className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">
              {assessment ? 'Select a class…' : 'Select an assessment first'}
            </option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {[cls.name, cls.gradeLevel].filter(Boolean).join(' - ')}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Out of (Total Marks)" hint="From the assessment">
          <input
            type="number"
            readOnly
            value={assessment?.maxScore ?? ''}
            placeholder="-"
            className="h-10 w-full rounded-md border border-input bg-muted/50 px-2.5 text-sm text-muted-foreground"
          />
        </Field>
      </div>

      {/* Stream is a subdivision of the class, so it appears only once the class
          the assessment is set against is known. */}
      {assessment && parentClass && parentClass.streams.length > 0 ? (
        <div className="max-w-xs rounded-lg border bg-card p-4">
          <Field label="Stream" hint="Optional. Narrows the roster to one stream.">
            <select
              value={streamId}
              onChange={(event) => {
                setStreamId(event.target.value);
                setDraft({});
                setHydratedFor(null);
              }}
              className="h-10 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Whole class</option>
              {parentClass.streams.map((stream) => (
                <option key={stream.id} value={stream.id}>
                  {stream.name}
                  {stream.code ? ` (${stream.code})` : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      {/* Nothing is shown until an assessment is chosen: a grid of invented
          learners and marks would be worse than an instruction. */}
      {!assessmentId || !effectiveClassId ? (
        <EmptyState
          title="Select an assessment to get started"
          description="Marks are entered against a created assessment so repeatable assessment types stay separate."
          icon="clipboard-check"
        />
      ) : grid.loading ? (
        <LoadingState label="Loading the learner roster" />
      ) : grid.error ? (
        <ErrorState
          title="Could not load the learner roster"
          message="The roster for this class could not be read. Confirm the API is running and that you are assigned to this class."
        />
      ) : areas.length === 0 ? (
        <EmptyState
          title="This assessment has no learning areas"
          description="Results are entered per learning area. Add the areas this assessment covers before entering marks."
          icon="shapes"
        />
      ) : gridRows.length === 0 ? (
        <EmptyState
          title="No eligible learners"
          description="Nobody is enrolled in this class for the selected stream, so there is nobody to score."
          icon="graduation-cap"
        />
      ) : grid.data?.locked ? (
        <div className="space-y-3">
          <div
            role="alert"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
          >
            This assessment is {grid.data.assessment.status}, so its results are locked. Reopen it
            before entering marks, so published results are not edited underneath reviewers.
          </div>
          <DataTable
            caption="Recorded results (read only)"
            columns={learnerColumns}
            rows={gridRows}
            rowKey={(row) => row.learner.id}
            pageSize={20}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {[
                grid.data?.assessment.className,
                grid.data?.assessment.gradeLevel,
                grid.data?.assessment.termNumber ? `Term ${grid.data.assessment.termNumber}` : null,
                grid.data?.assessment.sessionName,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <StatusPill
              label={`${grid.data?.summary.recorded ?? 0} of ${
                grid.data?.summary.cells ?? 0
              } recorded`}
              tone={
                (grid.data?.summary.recorded ?? 0) === (grid.data?.summary.cells ?? 0) &&
                (grid.data?.summary.cells ?? 0) > 0
                  ? 'success'
                  : 'warning'
              }
            />
          </div>

          <DataTable
            caption={`Results for ${grid.data?.assessment.title ?? ''}`}
            columns={learnerColumns}
            rows={gridRows}
            rowKey={(row) => row.learner.id}
            pageSize={20}
            empty={
              <EmptyState
                title="No learners in this context"
                description="Enrol learners into the class, or pick a different stream."
                icon="graduation-cap"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            Each cell is one learner&rsquo;s result in one learning area, saved against the
            assessment and updated rather than duplicated. A mark above the assessment&rsquo;s
            maximum is refused by the API, and the CBC competency level beside each mark is derived
            from it.
          </p>
        </>
      )}
    </div>
  );
}
