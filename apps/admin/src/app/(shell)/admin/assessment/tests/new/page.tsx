'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  Select,
  SettingsCard,
  TextArea,
  TextInput,
  notify,
} from '@schoolos/ui';

/**
 * Create a summative assessment.
 *
 * `POST /api/examinations` accepts an academic session and term, so the
 * assessment joins the same context the navbar selects rather than standing on
 * loose dates. The session defaults to the active one, so the common case needs
 * no selection at all.
 *
 * Types offered come from the records the school has actually used, via
 * `GET /api/examinations/options`, rather than a list invented here.
 */
interface SessionOption {
  id: string;
  name: string;
  label?: string | null;
  status?: string;
}

interface TermOption {
  id: string;
  academicYearId: string;
  name: string;
  termNumber: number;
}

interface OptionsResponse {
  assessmentTypes?: Array<{ value: string; label: string }>;
  grades?: Array<{ value: string; label: string; classId: string }>;
}

export default function AdminNewAssessmentPage() {
  const { can } = useAuth();
  const allowed = can('examinations.manage');
  const router = useRouter();

  const sessions = useApi<{ sessions?: SessionOption[] }>(
    allowed ? '/api/academic-sessions?limit=50' : null
  );
  const current = useApi<{ session?: { terms?: TermOption[] } | null }>(
    allowed ? '/api/academic-sessions/current' : null
  );
  const options = useApi<OptionsResponse>(allowed ? '/api/examinations/options' : null);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [academicYearId, setAcademicYearId] = React.useState('');
  const [termId, setTermId] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [assessmentType, setAssessmentType] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [maxScore, setMaxScore] = React.useState('100');
  const [status, setStatus] = React.useState('draft');
  const [saving, setSaving] = React.useState(false);

  const activeSession = React.useMemo(
    () => sessions.data?.sessions?.find((s) => s.status === 'active') ?? null,
    [sessions.data]
  );

  // Default to the session the navbar is showing, so the assessment lands in
  // the current academic context without being asked.
  React.useEffect(() => {
    if (!academicYearId && activeSession) setAcademicYearId(activeSession.id);
  }, [academicYearId, activeSession]);

  const rangeInvalid =
    Boolean(startDate) && Boolean(endDate) && new Date(endDate) <= new Date(startDate);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch('/api/examinations', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          academicYearId: academicYearId || undefined,
          termId: termId || undefined,
          classId: classId || undefined,
          assessmentType: assessmentType || undefined,
          status,
          startDate,
          ...(endDate ? { endDate } : {}),
          ...(maxScore ? { maxScore: Number(maxScore) } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(
          body?.error?.message ?? `The API refused the assessment (HTTP ${res.status}).`
        );
        return;
      }

      router.push('/admin/assessment/tests');
      router.refresh();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="New Assessment" />
        <ErrorState
          title="You do not have access to manage assessments"
          message="Creating an assessment requires examinations.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (sessions.loading || options.loading) {
    return <LoadingState label="Loading academic context" />;
  }

  const sessionList = sessions.data?.sessions ?? [];
  const termList = current.data?.session?.terms ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="New Assessment"
        description="A summative assessment, attached to the academic session and term the rest of the platform resolves."
        action={
          <a
            href="/admin/assessment/tests"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Tests
          </a>
        }
      />

      <SettingsCard
        title="Assessment details"
        description="Title, academic context and the dates the lifecycle is derived from."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Title" required>
            <TextInput
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="End of Term 2 Mathematics"
            />
          </Field>
          <Field label="Assessment type" hint="From the types this school has used">
            <Select
              value={assessmentType}
              onChange={(event) => setAssessmentType(event.target.value)}
            >
              <option value="">Not set</option>
              {(options.data?.assessmentTypes ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Academic session"
            hint={
              activeSession
                ? `Defaults to the current session, ${activeSession.label ?? activeSession.name}`
                : 'No session is currently active'
            }
          >
            <Select
              value={academicYearId}
              onChange={(event) => {
                setAcademicYearId(event.target.value);
                setTermId('');
              }}
            >
              <option value="">Not in a session</option>
              {sessionList.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.label ?? session.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Term" hint="Terms belonging to the current session">
            <Select value={termId} onChange={(event) => setTermId(event.target.value)}>
              <option value="">Not in a term</option>
              {termList.map((term) => (
                <option key={term.id} value={term.id}>
                  Term {term.termNumber}
                  {term.name ? ` · ${term.name}` : ''}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Grade / class"
            hint="Marks can only be recorded for a learner enrolled in this class"
          >
            <Select value={classId} onChange={(event) => setClassId(event.target.value)}>
              <option value="">No class</option>
              {(options.data?.grades ?? []).map((grade) => (
                <option key={grade.value} value={grade.classId}>
                  {grade.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Initial status" hint="A draft is not visible to learners">
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </Field>
          <Field label="Start date" required>
            <TextInput
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              placeholder="mm/dd/yyyy"
            />
          </Field>
          <Field
            label="End date"
            error={rangeInvalid ? 'End date must be after the start date' : undefined}
          >
            <TextInput
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              placeholder="mm/dd/yyyy"
            />
          </Field>
          <Field label="Maximum score" hint="Marks above this are rejected by the API">
            <TextInput
              type="number"
              min={0}
              value={maxScore}
              onChange={(event) => setMaxScore(event.target.value)}
              placeholder="100"
            />
          </Field>
        </div>

        <div className="mt-5">
          <Field label="Description" hint="Optional context for learners and reviewers">
            <TextArea
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A short introduction, used on reports and the website."
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving || !title.trim() || !startDate || rangeInvalid}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create assessment'}
          </button>
          <a
            href="/admin/assessment/tests"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            Cancel
          </a>
        </div>
      </SettingsCard>
    </div>
  );
}
