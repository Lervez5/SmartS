'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
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
  code: string;
  minScore: number;
  maxScore: number;
  points: number | null;
}

interface Scale {
  id: string;
  name: string;
  description: string | null;
  gradeMin: number;
  gradeMax: number;
  version: number;
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string | null;
  createdAt: string;
  updatedAt: string;
  bands: Band[];
}

interface ScaleDetail {
  scale: Scale;
  inUse: boolean;
  usedCount: number;
}

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function AdminGradingPage() {
  const { can } = useAuth();
  const allowed = can('grading.view');
  const canManage = can('grading.manage');

  const [gradeFilter, setGradeFilter] = React.useState<string>('');
  const gradesApiUrl = gradeFilter ? `/api/grading?grade=${gradeFilter}` : '/api/grading';
  const { data, loading, error, refetch } = useApi<{ scales: Scale[] }>(gradesApiUrl);

  const [seeding, setSeeding] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<ScaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [mutating, setMutating] = React.useState(false);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/grading/seed', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
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
  };

  const loadDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/grading/${id}`, { credentials: 'include' });
      if (!res.ok) {
        setDetailError(`HTTP ${res.status}`);
        return;
      }
      const body = (await res.json()) as ScaleDetail;
      setDetail(body);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    setMutating(true);
    try {
      const res = await fetch(`/api/grading/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Update failed (HTTP ${res.status}).`);
        return;
      }
      notify.success(`Scale ${!current ? 'activated' : 'deactivated'}`);
      refetch();
      setDetail(null);
      setDetailId(null);
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setMutating(false);
    }
  };

  const deleteScale = async (id: string) => {
    if (
      !confirm(
        'Delete this grading scale? This cannot be undone if it is referenced by finalized results.'
      )
    )
      return;
    setMutating(true);
    try {
      const res = await fetch(`/api/grading/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Delete failed (HTTP ${res.status}).`);
        return;
      }
      notify.success('Scale deleted');
      refetch();
      setDetail(null);
      setDetailId(null);
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setMutating(false);
    }
  };

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Grading Configuration" />
        <ErrorState
          title="You do not have access to grading configuration"
          message="This page requires grading.view."
        />
      </div>
    );
  }

  const scales = data?.scales ?? [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Grading Configuration"
        description="Manage the school's Racefield grading standards. Each scale covers a range of grade levels and defines bands with score boundaries, codes, and points."
        action={
          canManage && scales.length === 0 ? (
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

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-foreground">Filter by grade</label>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All grades</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={String(g)}>
              Grade {g}
            </option>
          ))}
        </select>
      </div>

      {loading && <LoadingState label="Loading grading scales" />}
      {error !== null && (
        <ErrorState
          title="Could not load grading scales"
          message="GET /api/grading failed. Confirm the API is running and that your session holds grading.view."
        />
      )}

      {!loading && !error && scales.length === 0 ? (
        <EmptyState
          title="No Racefield scales configured"
          description="Seed the three Racefield grading scales to enable automatic grade calculation."
          icon="bar-chart-3"
          action={
            canManage ? (
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
      ) : null}

      {!loading && !error && scales.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {scales.map((scale) => (
            <div key={scale.id} className="rounded-xl border bg-card/50 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-foreground">{scale.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Grades {scale.gradeMin} – {scale.gradeMax}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Version {scale.version}</span>
                    {scale.isDefault && <StatusPill label="Default" tone="info" />}
                    {scale.effectiveFrom && (
                      <span>
                        Effective from {new Date(scale.effectiveFrom).toLocaleDateString()}
                      </span>
                    )}
                    <span>Updated {new Date(scale.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    label={scale.isActive ? 'Active' : 'Inactive'}
                    tone={scale.isActive ? 'success' : 'neutral'}
                  />
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => loadDetail(scale.id)}
                        className="rounded-md border border-input bg-background px-3 py-1 text-sm font-medium hover:bg-accent"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(scale.id, scale.isActive)}
                        disabled={mutating}
                        className="rounded-md border border-input bg-background px-3 py-1 text-sm font-medium hover:bg-accent disabled:opacity-50"
                      >
                        {scale.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-xs font-medium text-muted-foreground uppercase">
                      <th className="pb-2 font-medium">Band</th>
                      <th className="pb-2 font-medium">Lower %</th>
                      <th className="pb-2 font-medium">Upper %</th>
                      <th className="pb-2 font-medium">Code</th>
                      <th className="pb-2 font-medium">Points</th>
                      <th className="pb-2 font-medium text-right">Label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scale.bands
                      .slice()
                      .sort((a, b) => b.minScore - a.minScore)
                      .map((band) => (
                        <tr key={band.id} className="border-b last:border-0">
                          <td className="py-1.5">{band.label}</td>
                          <td className="py-1.5">{band.minScore}</td>
                          <td className="py-1.5">{band.maxScore}</td>
                          <td className="py-1.5 font-mono text-xs">{band.code}</td>
                          <td className="py-1.5">{band.points ?? '-'}</td>
                          <td className="py-1.5 text-right">{band.label}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {canManage && detailId === scale.id && detail && (
                <div className="mt-4 rounded-lg border bg-card/50 p-4">
                  {detailLoading && <LoadingState label="Loading details" />}
                  {detailError && <ErrorState title="Error" message={detailError} />}
                  {!!detail && (
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium">Used by</span> {detail.usedCount} finalized
                        result(s)
                      </p>
                      <p>
                        <span className="font-medium">In use</span>{' '}
                        {detail.inUse ? 'Yes — cannot be deleted' : 'No — safe to delete'}
                      </p>
                      {detail.scale.description && (
                        <p>
                          <span className="font-medium">Description</span>{' '}
                          {detail.scale.description}
                        </p>
                      )}
                      {!detail.inUse && (
                        <button
                          type="button"
                          onClick={() => deleteScale(scale.id)}
                          disabled={mutating}
                          className="rounded-md border border-destructive bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
                        >
                          Delete scale
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
