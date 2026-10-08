'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  DashboardCard,
  EmptyState,
  ErrorState,
  LoadingState,
  SectionHeader,
  StatusPill,
  notify,
} from '@schoolos/ui';

interface Band {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
}

interface Scale {
  id: string;
  name: string;
  gradeMin: number;
  gradeMax: number;
  isActive: boolean;
  bands: Band[];
}

export default function AdminGradingPage() {
  const { can } = useAuth();
  const allowed = can('grading.view');
  const { data, loading, error, refetch } = useApi<{ scales: Scale[] }>('/api/grading');
  const [seeding, setSeeding] = React.useState(false);

  async function seed() {
    setSeeding(true);
    try {
      const res = await fetch('/api/grading/seed', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        notify.error(body?.error?.message ?? `Seed failed (HTTP ${res.status}).`);
        return;
      }
      notify.success('Racefield grading scales seeded');
      refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setSeeding(false);
    }
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Grading Configuration" />
        <ErrorState
          title="You do not have access to grading configuration"
          message="This page requires grading.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Grading Configuration" />
        <LoadingState label="Loading grading configuration" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Grading Configuration" />
        <ErrorState
          title="Could not load grading configuration"
          message="GET /api/grading requires grading.view. Confirm the API is running and that your session still holds the permission."
        />
      </div>
    );
  }

  const scales = data?.scales ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Grading Configuration"
        description="The school's Racefield grading standards, tied to grade levels."
        action={
          scales.length === 0 ? (
            <button
              type="button"
              onClick={seed}
              disabled={seeding}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {seeding ? 'Seeding…' : 'Seed Racefield Scales'}
            </button>
          ) : null
        }
      />

      {scales.length === 0 ? (
        <EmptyState
          title="No Racefield scales configured"
          description="The school's grading standards have not been seeded yet. Seed the three Racefield scales to enable automatic grade calculation."
          icon="bar-chart-3"
          action={
            can('grading.manage') ? (
              <button
                type="button"
                onClick={seed}
                disabled={seeding}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {seeding ? 'Seeding…' : 'Seed Racefield Scales'}
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {scales.map((scale) => (
            <div
              key={scale.id}
              className="rounded-xl border bg-card/50 p-6"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-foreground">{scale.name}</h3>
                  <p className="text-sm text-muted-foreground">Grades {scale.gradeMin} - {scale.gradeMax}</p>
                </div>
                <StatusPill label={scale.isActive ? 'Active' : 'Inactive'} tone={scale.isActive ? 'success' : 'neutral'} />
              </div>
              <div className="mt-4 space-y-2">
                {scale.bands.map((band) => (
                  <div
                    key={band.id}
                    className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-2.5"
                  >
                    <span className="text-sm font-medium text-foreground">{band.label}</span>
                    <span className="text-sm text-muted-foreground">
                      {band.minScore}% - {band.maxScore}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
