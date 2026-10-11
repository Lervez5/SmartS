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
  Modal,
  ModalFooter,
  Button,
  Input,
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

interface BandDraft {
  label: string;
  code: string;
  minScore: string;
  maxScore: string;
  points: string;
}

interface ScaleFormState {
  name: string;
  description: string;
  gradeMin: string;
  gradeMax: string;
  isDefault: boolean;
  isActive: boolean;
  bands: BandDraft[];
}

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const EMPTY_BAND: BandDraft = { label: '', code: '', minScore: '', maxScore: '', points: '' };

function emptyForm(): ScaleFormState {
  return {
    name: '',
    description: '',
    gradeMin: '1',
    gradeMax: '1',
    isDefault: false,
    isActive: true,
    bands: [{ ...EMPTY_BAND }],
  };
}

function formFromScale(scale: Scale): ScaleFormState {
  return {
    name: scale.name,
    description: scale.description ?? '',
    gradeMin: String(scale.gradeMin),
    gradeMax: String(scale.gradeMax),
    isDefault: scale.isDefault,
    isActive: scale.isActive,
    bands: scale.bands
      .slice()
      .sort((a, b) => b.minScore - a.minScore)
      .map((b) => ({
        label: b.label,
        code: b.code,
        minScore: String(b.minScore),
        maxScore: String(b.maxScore),
        points: b.points === null ? '' : String(b.points),
      })),
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? `${fallback} (HTTP ${res.status}).`;
}

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

  // Create / edit modal state.
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<ScaleFormState>(emptyForm);
  const [formError, setFormError] = React.useState<string | null>(null);

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await fetch('/api/grading/seed', { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        notify.error(await readError(res, 'Seed failed'));
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
        notify.error(await readError(res, 'Update failed'));
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
        notify.error(await readError(res, 'Delete failed'));
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

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (scale: Scale) => {
    setEditingId(scale.id);
    setForm(formFromScale(scale));
    setFormError(null);
    setFormOpen(true);
  };

  const updateBand = (index: number, patch: Partial<BandDraft>) => {
    setForm((prev) => ({
      ...prev,
      bands: prev.bands.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  };

  const addBand = () => setForm((prev) => ({ ...prev, bands: [...prev.bands, { ...EMPTY_BAND }] }));

  const removeBand = (index: number) =>
    setForm((prev) => ({ ...prev, bands: prev.bands.filter((_, i) => i !== index) }));

  const submitForm = async () => {
    setFormError(null);

    const gradeMin = Number(form.gradeMin);
    const gradeMax = Number(form.gradeMax);
    if (!Number.isInteger(gradeMin) || !Number.isInteger(gradeMax)) {
      setFormError('Grade range must be whole numbers between 1 and 9.');
      return;
    }
    if (gradeMin < 1 || gradeMax > 9 || gradeMin > gradeMax) {
      setFormError('gradeMin must be at least 1, gradeMax at most 9, and gradeMin ≤ gradeMax.');
      return;
    }
    if (form.bands.length === 0) {
      setFormError('At least one band is required.');
      return;
    }
    for (const [i, b] of form.bands.entries()) {
      if (!b.label.trim() || !b.code.trim()) {
        setFormError(`Band ${i + 1}: label and code are required.`);
        return;
      }
      if (!Number.isFinite(Number(b.minScore)) || !Number.isFinite(Number(b.maxScore))) {
        setFormError(`Band ${b.code || i + 1}: scores must be numbers.`);
        return;
      }
    }

    const bands = form.bands.map((b) => ({
      label: b.label.trim(),
      code: b.code.trim(),
      minScore: Number(b.minScore),
      maxScore: Number(b.maxScore),
      points: b.points.trim() === '' ? null : Number(b.points),
    }));

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() === '' ? null : form.description.trim(),
      gradeMin,
      gradeMax,
      isDefault: form.isDefault,
      isActive: form.isActive,
      bands,
    };

    if (!payload.name) {
      setFormError('A scale name is required.');
      return;
    }

    setMutating(true);
    try {
      const res = await fetch(editingId ? `/api/grading/${editingId}` : '/api/grading', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        notify.error(await readError(res, editingId ? 'Update failed' : 'Create failed'));
        return;
      }
      notify.success(editingId ? 'Scale updated' : 'Scale created');
      setFormOpen(false);
      setEditingId(null);
      refetch();
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
        description="Manage the school's grading standards. Each scale covers a range of grade levels and defines bands with score boundaries, codes, and points."
        action={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              {scales.length === 0 && (
                <button
                  type="button"
                  onClick={seed}
                  disabled={seeding}
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {seeding ? 'Seeding…' : 'Seed Racefield Scales'}
                </button>
              )}
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Create scale
              </button>
            </div>
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
          title="No grading scales configured"
          description="Create your own grading scale, or seed the three Racefield grading scales to enable automatic grade calculation."
          icon="bar-chart-3"
          action={
            canManage ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={seed}
                  disabled={seeding}
                  className="inline-flex h-9 items-center rounded-md border border-input bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {seeding ? 'Seeding…' : 'Seed Racefield Scales'}
                </button>
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Create scale
                </button>
              </div>
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
                        onClick={() => openEdit(scale)}
                        className="rounded-md border border-input bg-background px-3 py-1 text-sm font-medium hover:bg-accent"
                      >
                        Edit
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
                        {detail.inUse ? 'Yes - cannot be deleted' : 'No - safe to delete'}
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

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit grading scale' : 'Create grading scale'}
        description="Define a score-to-grade mapping. Bands must not overlap and each grade code must be unique."
        icon="bar-chart-3"
        size="2xl"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="scale-name" className="text-sm font-medium text-foreground">
                Scale name
              </label>
              <Input
                id="scale-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. CBC Lower Primary"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label htmlFor="scale-desc" className="text-sm font-medium text-foreground">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                id="scale-desc"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="What this scale is used for"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="scale-gmin" className="text-sm font-medium text-foreground">
                Grade from
              </label>
              <select
                id="scale-gmin"
                value={form.gradeMin}
                onChange={(e) => setForm((p) => ({ ...p, gradeMin: e.target.value }))}
                className="h-10.5 w-full rounded-xl border border-input/80 bg-background/80 px-3.5 text-sm"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="scale-gmax" className="text-sm font-medium text-foreground">
                Grade to
              </label>
              <select
                id="scale-gmax"
                value={form.gradeMax}
                onChange={(e) => setForm((p) => ({ ...p, gradeMax: e.target.value }))}
                className="h-10.5 w-full rounded-xl border border-input/80 bg-background/80 px-3.5 text-sm"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={String(g)}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              Default for its grade range
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">Bands</h4>
              <button
                type="button"
                onClick={addBand}
                className="rounded-md border border-input bg-background px-3 py-1 text-xs font-semibold hover:bg-accent"
              >
                + Add band
              </button>
            </div>
            <div className="mt-3 space-y-3">
              <div className="hidden grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto] gap-2 text-xs font-medium text-muted-foreground sm:grid">
                <span>Label</span>
                <span>Code</span>
                <span>Min %</span>
                <span>Max %</span>
                <span>Points</span>
                <span />
              </div>
              {form.bands.map((band, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-[1.4fr_1fr_0.8fr_0.8fr_0.8fr_auto] sm:items-center"
                >
                  <Input
                    value={band.label}
                    onChange={(e) => updateBand(i, { label: e.target.value })}
                    placeholder="Exceeding"
                    aria-label={`Band ${i + 1} label`}
                  />
                  <Input
                    value={band.code}
                    onChange={(e) => updateBand(i, { code: e.target.value })}
                    placeholder="EE"
                    aria-label={`Band ${i + 1} code`}
                  />
                  <Input
                    type="number"
                    value={band.minScore}
                    onChange={(e) => updateBand(i, { minScore: e.target.value })}
                    placeholder="80"
                    aria-label={`Band ${i + 1} min score`}
                  />
                  <Input
                    type="number"
                    value={band.maxScore}
                    onChange={(e) => updateBand(i, { maxScore: e.target.value })}
                    placeholder="100"
                    aria-label={`Band ${i + 1} max score`}
                  />
                  <Input
                    type="number"
                    value={band.points}
                    onChange={(e) => updateBand(i, { points: e.target.value })}
                    placeholder="-"
                    aria-label={`Band ${i + 1} points`}
                  />
                  <button
                    type="button"
                    onClick={() => removeBand(i)}
                    disabled={form.bands.length === 1}
                    className="justify-self-start rounded-md border border-input bg-background px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
                    aria-label={`Remove band ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <ModalFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={mutating}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={mutating}>
              {mutating ? 'Saving…' : editingId ? 'Save changes' : 'Create scale'}
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
