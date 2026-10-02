'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ConfirmButton,
  DashboardCard,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
} from '@schoolos/ui';

/**
 * Marks entry for a summative assessment.
 *
 * `PUT /api/examinations/:id/marks` is the write. Attempts are not typed in by
 * hand: they are seeded from the class enrolment with
 * `POST /api/examinations/:id/attempts`, so a score can only ever be recorded
 * for a learner who was actually sitting the assessment.
 *
 * Two API rules are enforced here rather than worked around:
 *  - a score above the assessment's maximum is refused
 *  - a learner cannot be marked graded without a score
 *
 * A completed assessment has its marks locked server-side, so the screen says so
 * instead of offering a save that would be rejected.
 */
interface Attempt {
  id: string;
  studentId: string | null;
  name: string;
  email: string;
  score: number | null;
  graded: boolean;
  submittedAt?: string | null;
}

interface AssessmentDetail {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'completed' | 'archived';
  lifecycle: string;
  maxScore?: number | null;
  class?: { id: string; name: string; gradeLevel?: string | null } | null;
  subject?: { id: string; name: string } | null;
  term?: { id: string; name: string; termNumber: number } | null;
  academicYear?: { id: string; name: string; label?: string | null } | null;
  attempts: Attempt[];
  scoredCount: number;
  averagePercent: number | null;
  classId: string | null;
}

export default function AdminAssessmentMarksPage() {
  const params = useParams();
  const assessmentId = params?.id as string | undefined;
  const router = useRouter();
  const { can } = useAuth();
  const canView = can('examinations.view');
  const canGrade = can('grading.manage');

  const { data, loading, error, refetch } = useApi<{ assessment: AssessmentDetail | null }>(
    canView ? `/api/examinations/${assessmentId}` : '/api/examinations?denied=1'
  );

  const assessment = data?.assessment ?? null;
  const locked = assessment?.status === 'completed' || assessment?.status === 'archived';

  const [draft, setDraft] = React.useState<Record<string, number | null>>({});
  const [seeding, setSeeding] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  // Seed the editable values from the saved scores once the record arrives.
  React.useEffect(() => {
    if (!assessment) return;
    const seeded: Record<string, number | null> = {};
    for (const attempt of assessment.attempts) {
      if (attempt.studentId) seeded[attemptIdKey(attempt.studentId)] = attempt.score;
    }
    setDraft(seeded);
  }, [assessment]);

  function attemptIdKey(studentId: string): string {
    return studentId;
  }

  const dirty = React.useMemo(() => {
    if (!assessment) return false;
    return assessment.attempts.some((attempt) => {
      if (!attempt.studentId) return false;
      return (draft[attemptIdKey(attempt.studentId)] ?? null) !== attempt.score;
    });
  }, [assessment, draft]);

  async function seedAttempts() {
    if (!assessment) return;
    setSeeding(true);
    setActionError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/examinations/${assessment.id}/attempts`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setActionError(body?.error?.message ?? `The API refused the seed (HTTP ${res.status}).`);
        return;
      }
      const body = (await res.json()) as { created: number; total: number };
      setDone(
        body.created === 0
          ? `No new attempts: all ${body.total} enrolled learners are already recorded.`
          : `${body.created} attempt${body.created === 1 ? '' : 's'} created from the class enrolment.`
      );
      refetch();
    } catch {
      setActionError('Could not reach the API. Check that it is running.');
    } finally {
      setSeeding(false);
    }
  }

  async function saveMarks(submit: boolean) {
    if (!assessment) return;
    setSaving(true);
    setActionError(null);
    setDone(null);
    try {
      const records = assessment.attempts
        .filter((attempt) => attempt.studentId)
        .map((attempt) => {
          const studentId = attempt.studentId as string;
          const score = draft[attemptIdKey(studentId)] ?? null;
          return {
            studentId,
            score,
            // Grading implies a score; the API refuses a graded null anyway, so
            // this does not paper over it.
            graded: score !== null,
          };
        });

      const res = await fetch(`/api/examinations/${assessment.id}/marks`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, submit }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setActionError(body?.error?.message ?? `The API refused the marks (HTTP ${res.status}).`);
        return;
      }

      const body = (await res.json()) as { saved: number };
      setDone(`${body.saved} mark${body.saved === 1 ? '' : 's'} saved.`);
      refetch();
      router.refresh();
    } catch {
      setActionError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Marks" />
        <ErrorState
          title="You do not have access to assessments"
          message="Viewing assessments requires examinations.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the assessment" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this assessment"
        message="GET /api/examinations requires examinations.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!assessment) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Marks" />
        <EmptyState
          title="Assessment not found"
          description="No assessment matches this identifier."
          icon="clipboard-check"
        />
      </div>
    );
  }

  const total = assessment.attempts.length;
  const scored = assessment.scoredCount;
  const pending = total - scored;

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Marks — ${assessment.title}`}
        description={[
          assessment.class?.name,
          assessment.subject?.name,
          assessment.term ? `Term ${assessment.term.termNumber}` : null,
          assessment.academicYear?.label ?? assessment.academicYear?.name,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canGrade && !locked ? (
              <>
                <ConfirmButton
                  label="Save marks"
                  confirmLabel="Save marks"
                  description={
                    pending > 0
                      ? `${pending} learner${pending === 1 ? '' : 's'} will be left unscored.`
                      : 'All scored learners will be marked graded.'
                  }
                  onConfirm={() => saveMarks(false)}
                  variant="default"
                  size="md"
                  icon="check"
                  disabled={!dirty || saving}
                />
                <a
                  href={`/admin/assessment/tests/${assessment.id}`}
                  className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Back to assessment
                </a>
              </>
            ) : (
              <a
                href={`/admin/assessment/tests/${assessment.id}`}
                className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Back to assessment
              </a>
            )}
          </div>
        }
      />

      {locked ? (
        <p
          role="alert"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
        >
          This assessment is {assessment.status}, so its marks are locked by the API. Reopen the
          assessment before entering marks, so published results are not edited underneath
          reviewers.
        </p>
      ) : null}

      {!canGrade ? (
        <p className="rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Marks are read-only for you. Entering results requires grading.manage, which is a stronger
          capability than viewing the assessment.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Attempts" value={total} icon="users" tone="accent" />
        <DashboardCard
          title="Scored"
          value={scored}
          icon="check"
          tone={scored === total && total > 0 ? 'success' : 'warning'}
          description={total > 0 ? `${Math.round((scored / total) * 100)}% complete` : undefined}
        />
        <DashboardCard
          title="Average"
          value={assessment.averagePercent !== null ? `${assessment.averagePercent}%` : '—'}
          icon="trending-up"
          description={assessment.maxScore ? `out of ${assessment.maxScore}` : undefined}
        />
        <DashboardCard
          title="Pending"
          value={pending}
          icon="triangle-alert"
          tone={pending > 0 ? 'warning' : 'success'}
          description="Not yet scored"
        />
      </div>

      {actionError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
        >
          {actionError}
        </div>
      ) : null}

      {done ? (
        <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {done}
        </p>
      ) : null}

      {total === 0 ? (
        <div className="space-y-3">
          <EmptyState
            title="No attempts yet"
            description={
              assessment.classId
                ? 'Attempts are taken from the class enrolment, so every enrolled learner can be scored.'
                : 'This assessment has no class, so there is no enrolment to take attempts from. Set a class on the assessment first.'
            }
            icon="users"
            action={
              canGrade && assessment.classId && !locked ? (
                <button
                  type="button"
                  onClick={seedAttempts}
                  disabled={seeding}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {seeding ? 'Seeding…' : 'Create attempts from enrolment'}
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  Learner
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-right font-semibold text-muted-foreground"
                >
                  Score
                </th>
                <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                  State
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {assessment.attempts.map((attempt) => {
                const key = attempt.studentId;
                const value = key ? (draft[key] ?? null) : null;
                const editable = canGrade && !locked && key !== null;
                return (
                  <tr key={attempt.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{attempt.name}</p>
                      <p className="text-xs text-muted-foreground">{attempt.email}</p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editable ? (
                        <input
                          type="number"
                          min={0}
                          max={assessment.maxScore ?? undefined}
                          value={value ?? ''}
                          onChange={(event) => {
                            if (!key) return;
                            const raw = event.target.value;
                            setDraft((prev) => ({
                              ...prev,
                              [key]: raw === '' ? null : Number(raw),
                            }));
                            setDone(null);
                          }}
                          aria-label={`Score for ${attempt.name}`}
                          className="h-9 w-24 rounded-md border border-input bg-background px-2.5 text-right text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      ) : (
                        <span className="text-foreground">{value ?? '—'}</span>
                      )}
                      {assessment.maxScore ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          / {assessment.maxScore}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {attempt.graded ? (
                        <StatusPill label="graded" tone="success" />
                      ) : value !== null ? (
                        <StatusPill label="entered" tone="warning" />
                      ) : (
                        <StatusPill label="not scored" tone="neutral" />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
