'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  Select,
  SettingsCard,
  StatusPill,
  TextInput,
} from '@schoolos/ui';

/**
 * Edit a learner profile.
 *
 * `PATCH /api/students/:id` accepts exactly the fields the create route does,
 * and the form exposes only those, so a learner cannot be corrected into a
 * state it could not have been created in. Names live on User and are not
 * editable here; class placement is not editable at all, because a learner joins
 * a class through Enrollment and there is no endpoint for that yet.
 */
interface Learner {
  id: string;
  name?: string | null;
  email: string;
  gradeLevel?: string | null;
  admissionId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  enrollmentDate?: string | null;
}

interface StudentsResponse {
  students?: Learner[];
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export default function AdminEditLearnerPage() {
  const params = useParams();
  const learnerId = params?.id as string | undefined;
  const router = useRouter();
  const { can } = useAuth();
  const allowed = can('students.manage');

  const { data, loading, error } = useApi<StudentsResponse>(
    allowed ? '/api/students?limit=200' : '/api/students?denied=1'
  );

  const learner = React.useMemo(
    () => (data?.students ?? []).find((row) => row.id === learnerId),
    [data, learnerId]
  );

  const [gradeLevel, setGradeLevel] = React.useState('');
  const [admissionId, setAdmissionId] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [dateOfBirth, setDateOfBirth] = React.useState('');
  const [enrollmentDate, setEnrollmentDate] = React.useState('');

  const [hydrated, setHydrated] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  // Seed the form once the record arrives, and only then, so a re-render of the
  // list does not clobber what the user is typing.
  React.useEffect(() => {
    if (!learner || hydrated) return;
    setGradeLevel(learner.gradeLevel ?? '');
    setAdmissionId(learner.admissionId ?? '');
    setGender(learner.gender ?? '');
    setDateOfBirth(formatDate(learner.dateOfBirth));
    setEnrollmentDate(formatDate(learner.enrollmentDate));
    setHydrated(true);
  }, [learner, hydrated]);

  const dirty =
    hydrated &&
    learner !== undefined &&
    (gradeLevel !== (learner.gradeLevel ?? '') ||
      admissionId !== (learner.admissionId ?? '') ||
      gender !== (learner.gender ?? '') ||
      dateOfBirth !== formatDate(learner.dateOfBirth) ||
      enrollmentDate !== formatDate(learner.enrollmentDate));

  async function save() {
    if (!learner) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/students/${learner.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeLevel: gradeLevel.trim() === '' ? null : gradeLevel.trim(),
          admissionId: admissionId.trim() === '' ? null : admissionId.trim(),
          gender: gender === '' ? null : gender,
          dateOfBirth: dateOfBirth === '' ? null : dateOfBirth,
          enrollmentDate: enrollmentDate === '' ? null : enrollmentDate,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setSaveError(body?.error?.message ?? `The API refused the change (HTTP ${res.status}).`);
        return;
      }

      setSaved(true);
      setHydrated(false);
      router.refresh();
    } catch {
      setSaveError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!learner) return;
    setGradeLevel(learner.gradeLevel ?? '');
    setAdmissionId(learner.admissionId ?? '');
    setGender(learner.gender ?? '');
    setDateOfBirth(formatDate(learner.dateOfBirth));
    setEnrollmentDate(formatDate(learner.enrollmentDate));
    setSaveError(null);
    setSaved(false);
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Learner" />
        <ErrorState
          title="You do not have access to edit learners"
          message="Editing requires students.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) return <LoadingState label="Loading the learner record" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load this learner"
        message="GET /api/students requires students.view. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!learner) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Edit Learner" />
        <ErrorState
          title="Learner not found"
          message="No learner in the directory matches this identifier."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Edit Learner"
        description={`${learner.name ?? learner.email}. Name and email belong to the account and are edited there; class placement has no endpoint yet.`}
        action={
          <a
            href={`/admin/students/${learner.id}`}
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to learner
          </a>
        }
      />

      <SettingsCard
        title="Learner details"
        description="Fields the learner profile holds. Clearing a field stores null rather than an empty string."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Grade level" hint="Free text; the schema has no Grade model">
            <TextInput
              value={gradeLevel}
              onChange={(event) => setGradeLevel(event.target.value)}
              placeholder="Year 7"
            />
          </Field>
          <Field
            label="Admission identifier"
            hint="Stored verbatim; the schema has no human-readable admission number"
          >
            <TextInput
              value={admissionId}
              onChange={(event) => setAdmissionId(event.target.value)}
            />
          </Field>
          <Field label="Gender">
            <Select value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="unspecified">Unspecified</option>
            </Select>
          </Field>
          <Field label="Date of birth">
            <TextInput
              type="date"
              value={dateOfBirth}
              onChange={(event) => setDateOfBirth(event.target.value)}
            />
          </Field>
          <Field label="Enrolment date">
            <TextInput
              type="date"
              value={enrollmentDate}
              onChange={(event) => setEnrollmentDate(event.target.value)}
            />
          </Field>
        </div>

        {saveError ? (
          <div
            role="alert"
            className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {saveError}
          </div>
        ) : null}

        {saved ? (
          <div className="mt-4">
            <StatusPill label="Saved" tone="success" />
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={discard}
            disabled={!dirty || saving}
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          >
            Discard
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}
