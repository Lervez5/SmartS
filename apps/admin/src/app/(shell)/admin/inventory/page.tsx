'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SectionHeader,
  SettingsCard,
  StatusPill,
  TextInput,
  notify,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * Asset Register - what the school owns.
 *
 * `Asset` carries the tag, name, category, purchase price and date, location and
 * state, so this is the register rather than a summary of it. Stock on a shelf
 * is a different question and has no model yet; that gap is stated rather than
 * filled with assets, which would make the two look identical.
 */
interface Asset {
  id: string;
  tag?: string | null;
  name: string;
  category?: string | null;
  purchasePriceCents?: number | null;
  currency?: string;
  purchaseDate?: string | null;
  status: string;
  location?: string | null;
}

interface AssetsResponse {
  assets?: Asset[];
  categories?: string[];
}

const STATUS_TONE: Record<string, StatusTone> = {
  in_use: 'success',
  in_repair: 'warning',
  retired: 'neutral',
};

function money(cents?: number | null, currency = 'KES'): string {
  if (cents === null || cents === undefined) return '-';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminAssetRegisterPage() {
  const { can } = useAuth();
  const allowed = can('inventory.view');
  const canManage = can('inventory.manage');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [sort, setSort] = React.useState('name_asc');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const params = new URLSearchParams({ sort });
  if (debounced) params.set('search', debounced);
  if (status) params.set('status', status);
  if (category) params.set('category', category);

  const { data, loading, error, refetch } = useApi<AssetsResponse>(
    allowed ? `/api/inventory?${params.toString()}` : '/api/inventory?denied=1'
  );

  const assets = React.useMemo(() => data?.assets ?? [], [data]);

  const [adding, setAdding] = React.useState(false);
  const [name, setName] = React.useState('');
  const [tag, setTag] = React.useState('');
  const [newCategory, setNewCategory] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const totalValue = assets.reduce((sum, asset) => sum + (asset.purchasePriceCents ?? 0), 0);
  const inUse = assets.filter((asset) => asset.status === 'in_use').length;
  const repair = assets.filter((asset) => asset.status === 'in_repair').length;
  const untagged = assets.filter((asset) => !asset.tag).length;

  async function createAsset() {
    setSaving(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          tag: tag.trim() || undefined,
          category: newCategory.trim() || undefined,
          purchasePriceCents: price.trim() ? Math.round(Number(price) * 100) : undefined,
          location: location.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setCreateError(body?.error?.message ?? `Could not add the asset (HTTP ${res.status}).`);
        return;
      }

      const created = (await res.json()) as { asset: Asset };
      notify.success(`${created.asset.name} added to the register`);
      setAdding(false);
      setName('');
      setTag('');
      setNewCategory('');
      setPrice('');
      setLocation('');
      refetch();
    } catch {
      setCreateError('Could not reach the API. Check that it is running.');
    } finally {
      setSaving(false);
    }
  }

  const columns: Array<DataTableColumn<Asset>> = [
    {
      id: 'asset',
      header: 'Asset',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{row.tag || 'No tag'}</p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'category',
      header: 'Category',
      cell: (row) => row.category ?? <span className="text-muted-foreground">-</span>,
      hideBelow: 'sm',
      sortValue: (row) => row.category ?? '',
    },
    {
      id: 'location',
      header: 'Location',
      cell: (row) => row.location ?? <span className="text-muted-foreground">-</span>,
      hideBelow: 'md',
      sortValue: (row) => row.location ?? '',
    },
    {
      id: 'value',
      header: 'Purchase Value',
      align: 'right',
      cell: (row) => money(row.purchasePriceCents, row.currency),
      sortValue: (row) => row.purchasePriceCents ?? 0,
    },
    {
      id: 'purchased',
      header: 'Purchased',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => formatDate(row.purchaseDate),
      sortValue: (row) => row.purchaseDate ?? '',
    },
    {
      id: 'status',
      header: 'Status',
      align: 'right',
      cell: (row) => (
        <StatusPill
          label={row.status.replace(/_/g, ' ')}
          tone={STATUS_TONE[row.status] ?? 'neutral'}
        />
      ),
      sortValue: (row) => row.status,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Asset Register" />
        <ErrorState
          title="You do not have access to the asset register"
          message="Viewing assets requires inventory.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Asset Register"
        description="Equipment the school owns: what it is, what it cost, where it is and what state it is in."
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              aria-expanded={adding}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {adding ? 'Cancel' : 'Add Asset'}
            </button>
          ) : null
        }
      />

      {loading ? (
        <LoadingState label="Loading the asset register" />
      ) : error ? (
        <ErrorState
          title="Could not load the asset register"
          message="GET /api/inventory requires inventory.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          {adding ? (
            <SettingsCard
              title="Add an asset"
              description="A tag is optional but unique when given, so an item can be located by it."
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Name" required>
                  <TextInput
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Desktop computer"
                  />
                </Field>
                <Field label="Asset tag" hint="Optional, unique when given">
                  <TextInput
                    value={tag}
                    onChange={(event) => setTag(event.target.value.toUpperCase())}
                    placeholder="INV-0042"
                  />
                </Field>
                <Field label="Category">
                  <TextInput
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="ICT"
                  />
                </Field>
                <Field label="Purchase value" hint="In whole shillings">
                  <TextInput
                    type="number"
                    min={0}
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder="85000"
                  />
                </Field>
                <Field label="Location">
                  <TextInput
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="Computer Lab 1"
                  />
                </Field>
              </div>

              {createError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {createError}
                </div>
              ) : null}

              <div className="mt-5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={createAsset}
                  disabled={saving || !name.trim()}
                  className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  {saving ? 'Adding…' : 'Add asset'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setCreateError(null);
                  }}
                  className="rounded-md border border-input bg-background px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Cancel
                </button>
              </div>
            </SettingsCard>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Assets"
              value={assets.length}
              icon="package"
              tone="accent"
              description={
                debounced || status || category ? 'Matching filters' : 'Everything on the register'
              }
            />
            <DashboardCard
              title="Purchase value"
              value={money(totalValue)}
              icon="wallet"
              description="Sum of recorded purchase prices"
            />
            <DashboardCard
              title="In use"
              value={inUse}
              icon="check"
              tone="success"
              description={`${repair} in repair`}
            />
            <DashboardCard
              title="Untagged"
              value={untagged}
              icon="triangle-alert"
              tone={untagged > 0 ? 'warning' : 'success'}
              description="No asset tag recorded"
            />
          </div>

          <DataTable
            caption="Assets the school owns"
            columns={columns}
            rows={assets}
            rowKey={(row) => row.id}
            pageSize={15}
            toolbar={
              <ContextFilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: 'Search by name, tag, category or location…',
                }}
                filters={[
                  {
                    id: 'status',
                    label: 'Status',
                    value: status,
                    options: [
                      { value: 'in_use', label: 'In use' },
                      { value: 'in_repair', label: 'In repair' },
                      { value: 'retired', label: 'Retired' },
                    ],
                    onChange: setStatus,
                    allLabel: 'All statuses',
                  },
                  {
                    id: 'category',
                    label: 'Category',
                    value: category,
                    options: (data?.categories ?? []).map((c) => ({ value: c, label: c })),
                    onChange: setCategory,
                    allLabel: 'All categories',
                  },
                  {
                    id: 'sort',
                    label: 'Sort by',
                    value: sort,
                    options: [
                      { value: 'name_asc', label: 'Name (A–Z)' },
                      { value: 'name_desc', label: 'Name (Z–A)' },
                      { value: 'value_desc', label: 'Highest value' },
                      { value: 'newest', label: 'Recently added' },
                    ],
                    onChange: setSort,
                    allowAll: false,
                  },
                ]}
              />
            }
            empty={
              <EmptyState
                title={
                  assets.length === 0 && !debounced && !status && !category
                    ? 'No assets on the register'
                    : 'No assets match these filters'
                }
                description={
                  assets.length === 0 && !debounced && !status && !category
                    ? 'Add the school’s equipment so it can be located and valued.'
                    : 'Adjust the search or filters above.'
                }
                icon="package"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            This register is what the school owns. What it holds as stock is a different record and
            has no model yet, so nothing here reports shelf stock or movements between stores.
          </p>
        </>
      )}
    </div>
  );
}
