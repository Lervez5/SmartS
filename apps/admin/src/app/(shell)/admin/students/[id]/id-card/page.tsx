'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import { ErrorState, LoadingState, SectionHeader, initialsOf } from '@schoolos/ui';

/**
 * Learner ID card.
 *
 * A rendered document, not a stored record: everything on the card is read from
 * data the platform already holds - the school's configured name and logo from
 * SchoolBrandingSettings, and the learner's identity from StudentProfile and
 * User. No new model is introduced, because nothing here needs persisting: a
 * card is generated on demand and printed.
 *
 * Card stock follows the ISO/IEC 7810 ID-1 proportion (85.6 x 54 mm), which is
 * what most school ID cards are printed to.
 */
interface Learner {
  id: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  avatar?: string | null;
  status: string;
  admissionId?: string | null;
  class: { name: string; classCode?: string | null; gradeLevel?: string | null } | null;
}

interface Branding {
  schoolId?: string;
  name?: string | null;
  displayName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
}

function displayName(learner: Learner): string {
  return learner.name ?? [learner.firstName, learner.lastName].filter(Boolean).join(' ') ?? '';
}

export default function AdminLearnerIdCardPage() {
  const params = useParams();
  const learnerId = params?.id as string | undefined;
  const { can } = useAuth();
  const allowed = can('students.view');

  const learners = useApi<{ students?: Learner[] }>(
    allowed ? '/api/students?limit=200' : '/api/students?denied=1'
  );
  const branding = useApi<Branding>(
    allowed ? '/api/settings/branding' : '/api/settings/branding?denied=1'
  );

  const learner = React.useMemo(
    () => (learners.data?.students ?? []).find((row) => row.id === learnerId),
    [learners.data, learnerId]
  );

  const schoolName = branding.data?.displayName ?? branding.data?.name ?? null;
  const accent = branding.data?.primaryColor || undefined;

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learner ID Card" />
        <ErrorState
          title="You do not have access to learner records"
          message="Viewing learners requires students.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (learners.loading || branding.loading) {
    return <LoadingState label="Preparing the ID card" />;
  }

  if (learners.error || branding.error) {
    return (
      <ErrorState
        title="Could not prepare the ID card"
        message="The learner directory and the school branding could not be read. Confirm the API is running and that your session still holds the permission."
      />
    );
  }

  if (!learner) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Learner ID Card" />
        <ErrorState
          title="Learner not found"
          message="No learner in the directory matches this identifier."
        />
      </div>
    );
  }

  const name = displayName(learner);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader
          title="Learner ID Card"
          description="Generated from the learner record and the school’s configured branding. Print on ID-1 stock (85.6 × 54 mm) or paste into a badge sleeve."
        />
        <div className="flex items-center gap-2" data-print-hide>
          <a
            href={`/admin/students/${learner.id}`}
            className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to learner
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Print card
          </button>
        </div>
      </div>

      {!schoolName ? (
        <p
          role="alert"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
        >
          The school has no name configured, so the card cannot identify its issuer. Set it under
          Administration → School Configuration before printing.
        </p>
      ) : null}

      <div className="flex justify-center py-4">
        <article
          className="w-[342px] overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg print:w-full print:rounded-none print:border-0 print:shadow-none"
          style={accent ? { borderTopColor: accent } : undefined}
        >
          {/* Issuer band */}
          <header
            className="flex items-center gap-3 px-4 py-3 text-white"
            style={{ backgroundColor: accent ?? 'hsl(var(--primary))' }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/20 text-sm font-bold">
              {branding.data?.logoUrl ? (
                <span
                  role="img"
                  aria-label=""
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${branding.data.logoUrl})` }}
                />
              ) : (
                initialsOf(schoolName)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{schoolName ?? 'School not configured'}</p>
              <p className="truncate text-[11px] uppercase tracking-wide opacity-80">
                Learner identification card
              </p>
            </div>
          </header>

          <div className="flex gap-4 p-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xl font-bold text-muted-foreground">
              {learner.avatar ? (
                <span
                  role="img"
                  aria-label=""
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${learner.avatar})` }}
                />
              ) : (
                initialsOf(name || learner.email)
              )}
            </span>

            <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Name
                </dt>
                <dd className="truncate font-semibold text-foreground">{name || 'Unnamed'}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Admission no.
                </dt>
                {/* The only admission identifier the schema carries is a raw
                    ObjectId, so the tail is what is legible. */}
                <dd className="truncate font-mono text-xs text-foreground">
                  {learner.admissionId ? learner.admissionId.slice(-8).toUpperCase() : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Class
                </dt>
                <dd className="truncate text-foreground">{learner.class?.name ?? 'Unplaced'}</dd>
              </div>
            </dl>
          </div>

          <footer className="flex items-center justify-between border-t px-4 py-2 text-[10px] text-muted-foreground">
            <span className="font-mono">{learner.id.slice(-10).toUpperCase()}</span>
            <span>Not valid for travel or identity</span>
          </footer>
        </article>
      </div>

      <p className="text-xs text-muted-foreground">
        The card is generated on demand and is not stored, so reissuing one after a name or class
        change produces the current record. Tracking issuance - when a card was printed, by whom,
        and replacements - needs an issuance record, which does not exist yet.
      </p>
    </div>
  );
}
