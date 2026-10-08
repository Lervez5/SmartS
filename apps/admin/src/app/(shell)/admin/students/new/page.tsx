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
  Select,
  SettingsCard,
  StatusPill,
  TextInput,
  roleLabel,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Enroll New - attach a learner profile to an existing account.
 *
 * `POST /api/students` takes a `userId` and creates the StudentProfile; it
 * deliberately does not create accounts. Accounts are provisioned separately
 * (invitation, or a future import), so this screen first narrows the register
 * to accounts that have no learner profile yet and then enrols one.
 *
 * Nothing is invented: the candidate list is the real user register filtered
 * client-side by the `hasStudentProfile` flag the API already returns.
 */
interface UserRow {
  id: string;
  email: string;
  name?: string | null;
  status?: string | null;
  role?: string | null;
  hasStudentProfile?: boolean;
  isActive?: boolean;
  invitationStatus?: string | null;
}

interface UsersResponse {
  users?: UserRow[];
}

function nameOf(user: UserRow): string {
  return user.name?.trim() || user.email;
}

export default function AdminEnrollLearnerPage() {
  const { can } = useAuth();
  const allowed = can('students.manage');

  const [selected, setSelected] = React.useState<string | null>(null);
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [admissionId, setAdmissionId] = React.useState('');
  const [gender, setGender] = React.useState('');
  const [dateOfBirth, setDateOfBirth] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const {
    data,
    loading,
    error: loadError,
  } = useApi<UsersResponse>(allowed ? '/api/users' : '/api/users?denied=1');

  const users = React.useMemo(() => data?.users ?? [], [data]);
  const candidates = React.useMemo(
    () => users.filter((user) => user.hasStudentProfile === false),
    [users]
  );

  const columns: Array<DataTableColumn<UserRow>> = [
    {
      id: 'name',
      header: 'Account',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{nameOf(row)}</p>
          <p className="truncate text-xs text-muted-foreground">{row.email}</p>
        </div>
      ),
      sortValue: (row) => nameOf(row),
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => (row.role ? <StatusPill label={roleLabel(row.role)} tone="neutral" /> : '-'),
      hideBelow: 'sm',
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <StatusPill
          label={
            row.invitationStatus === 'pending' ? 'invited' : row.isActive ? 'active' : 'inactive'
          }
          tone={row.isActive ? 'success' : 'warning'}
        />
      ),
      hideBelow: 'md',
    },
    {
      id: 'pick',
      header: 'Enrol',
      align: 'right',
      cell: (row) => (
        <button
          type="button"
          onClick={() => {
            setSelected(row.id);
            setDone(null);
            setError(null);
          }}
          className={[
            'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected === row.id
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background hover:bg-accent',
          ].join(' ')}
        >
          {selected === row.id ? 'Selected' : 'Select'}
        </button>
      ),
    },
  ];

  async function submit() {
    if (!selected) {
      setError('Select an account to enrol first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selected,
          ...(gradeLevel ? { gradeLevel } : {}),
          ...(admissionId ? { admissionId } : {}),
          ...(gender && gender !== 'unspecified' ? { gender } : {}),
          ...(dateOfBirth ? { dateOfBirth } : {}),
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? `The API refused the enrolment (HTTP ${res.status}).`);
        return;
      }

      const created = (await res.json()) as { user?: { name?: string | null; email?: string } };
      setDone(created.user?.name ?? created.user?.email ?? 'Learner enrolled');
      setSelected(null);
      setGradeLevel('');
      setAdmissionId('');
      setGender('');
      setDateOfBirth('');
    } catch {
      setError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Enroll New Learner" />
        <ErrorState
          title="You do not have access to enrol learners"
          message="Enrolling requires students.manage. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Enroll New Learner"
        description="Attach a learner profile to an account that does not have one yet. Accounts themselves are provisioned separately."
        action={
          <a
            href="/admin/students"
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Active Learners
          </a>
        }
      />

      {loading ? (
        <LoadingState label="Loading accounts" />
      ) : loadError ? (
        <ErrorState
          title="Could not load accounts"
          message="GET /api/users requires users.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <SettingsCard
          title="Learner details"
          description="Only the learner profile is created here. Grade and stream are set by class placement, not by this form."
        >
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Grade level" hint="Optional, free text">
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
                placeholder="admission identifier"
              />
            </Field>
            <Field label="Gender">
              <Select value={gender} onChange={(event) => setGender(event.target.value)}>
                <option value="">Not specified</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </Field>
            <Field label="Date of birth">
              <TextInput
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                placeholder="mm/dd/yyyy"
              />
            </Field>
          </div>

          {selected ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Enrolling{' '}
              <span className="font-medium text-foreground">
                {nameOf(users.find((user) => user.id === selected) ?? ({ email: '' } as UserRow))}
              </span>
            </p>
          ) : null}

          {error ? (
            <div
              role="alert"
              className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}

          {done ? (
            <div className="mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {done} now has a learner profile and appears in Active Learners.
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={saving || !selected}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? 'Enrolling…' : 'Enroll learner'}
            </button>
            {selected ? (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </SettingsCard>
      )}

      {loading || loadError ? null : (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Accounts without a learner profile
            </h2>
            <p className="text-sm text-muted-foreground">
              {candidates.length === 0
                ? 'Every account already has a learner profile.'
                : `${candidates.length} of ${users.length} accounts can be enrolled.`}
            </p>
          </div>
          <DataTable
            caption="Accounts that do not yet have a learner profile"
            columns={columns}
            rows={candidates}
            rowKey={(row) => row.id}
            pageSize={10}
            empty={
              <EmptyState
                title="No accounts to enrol"
                description="Every account already has a learner profile, or no accounts exist yet."
                icon="graduation-cap"
              />
            }
          />
        </section>
      )}
    </div>
  );
}
