'use client';

import * as React from 'react';
import { cn } from '@schoolos/utils';
import { NavIcon } from './NavIcon';

/* ------------------------------------------------------------------ *
 * DataTable
 *
 * A generic, permission-aware table. Callers pass already-filtered rows, so the
 * component never decides what a user may see; it only decides how to present
 * what it was given. Row actions are gated by the caller via `can`.
 * ------------------------------------------------------------------ */

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  /** Cell renderer. Return `null` to render an em dash placeholder. */
  cell: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  /** Hide on small screens to keep the mobile drawer readable. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  /** Right-align, for numeric and action columns. */
  align?: 'left' | 'right';
  /** Sortable column label; requires a stable accessor below. */
  sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  caption?: string;
  /** Rendered in place of the body when `rows` is empty. */
  empty?: React.ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  /** Row-level contextual actions, already permission-filtered by the caller. */
  renderRowActions?: (row: T) => React.ReactNode;
  className?: string;
  /** Number of rows per page. Omit to disable pagination. */
  pageSize?: number;
  /** Optional toolbar above the table, typically a ContextFilterBar. */
  toolbar?: React.ReactNode;
}

const HIDE_CLASS: Record<NonNullable<DataTableColumn<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  empty,
  loading,
  onRowClick,
  renderRowActions,
  className,
  pageSize,
  toolbar,
}: DataTableProps<T>) {
  const [page, setPage] = React.useState(0);
  const [sort, setSort] = React.useState<{
    id: string;
    dir: 'asc' | 'desc';
  } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort, columns]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const paged = pageSize
    ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sorted;

  React.useEffect(() => {
    setPage(0);
  }, [rows.length]);

  function toggleSort(id: string) {
    setSort((current) => {
      if (current?.id !== id) return { id, dir: 'asc' };
      if (current.dir === 'asc') return { id, dir: 'desc' };
      return null;
    });
  }

  if (loading) {
    return (
      <div className={cn('rounded-lg border', className)}>
        <div className="flex min-h-[180px] items-center justify-center">
          <span
            aria-hidden
            className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {toolbar}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full caption-bottom text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="border-b bg-muted/40">
            <tr>
              {columns.map((column) => {
                const isSorted = sort?.id === column.id;
                const hide = column.hideBelow ? HIDE_CLASS[column.hideBelow] : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    className={cn(
                      'whitespace-nowrap px-4 py-3 text-left align-middle font-semibold text-muted-foreground',
                      column.align === 'right' && 'text-right',
                      hide,
                      column.headerClassName
                    )}
                    aria-sort={
                      isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.id)}
                        className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {column.header}
                        <NavIcon
                          name={
                            isSorted
                              ? sort.dir === 'asc'
                                ? 'arrow-up'
                                : 'arrow-down'
                              : 'arrow-up-down'
                          }
                          className="h-3 w-3 opacity-60"
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {renderRowActions ? (
                <th
                  scope="col"
                  className="w-px whitespace-nowrap px-4 py-3 text-right align-middle font-semibold text-muted-foreground"
                >
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (renderRowActions ? 1 : 0)}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  {empty ?? 'No records to display.'}
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    className={cn(
                      'transition-colors hover:bg-muted/40',
                      onRowClick && 'cursor-pointer'
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((column) => {
                      const hide = column.hideBelow ? HIDE_CLASS[column.hideBelow] : undefined;
                      const content = column.cell(row);
                      return (
                        <td
                          key={column.id}
                          className={cn(
                            'px-4 py-3 align-middle',
                            column.align === 'right' && 'text-right',
                            hide,
                            column.className
                          )}
                        >
                          {content ?? <span className="text-muted-foreground">-</span>}
                        </td>
                      );
                    })}
                    {renderRowActions ? (
                      <td
                        className="whitespace-nowrap px-4 py-3 text-right align-middle"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderRowActions(row)}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageSize && totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)}{' '}
            of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="rounded-md border border-input bg-background px-2.5 py-1 font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="sr-only">Previous page</span>
              <NavIcon name="chevron-left" className="h-4 w-4" />
            </button>
            <span>
              Page {safePage + 1} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
              className="rounded-md border border-input bg-background px-2.5 py-1 font-medium hover:bg-accent disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="sr-only">Next page</span>
              <NavIcon name="chevron-right" className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ContextFilterBar
 *
 * The canonical filter strip for assessment-style screens. Academic year,
 * term, grade, class and learning area are first-class context, so they get
 * a stable home rather than being re-invented per page.
 * ------------------------------------------------------------------ */

export interface ContextFilter {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  /** Show a "All" option that clears the filter. */
  allowAll?: boolean;
  allLabel?: string;
}

export interface ContextFilterBarProps {
  filters: ContextFilter[];
  /** Free-text search, rendered first when supplied. */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Trailing controls, typically a primary action. */
  actions?: React.ReactNode;
  className?: string;
}

export function ContextFilterBar({ filters, search, actions, className }: ContextFilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3', className)}>
      {search ? (
        <div className="min-w-[200px] flex-1">
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor="ctx-search"
          >
            Search
          </label>
          <div className="relative">
            <NavIcon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="ctx-search"
              type="search"
              value={search.value}
              onChange={(event) => search.onChange(event.target.value)}
              placeholder={search.placeholder ?? 'Search…'}
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      ) : null}

      {filters.map((filter) => (
        <div key={filter.id} className="min-w-[150px]">
          <label
            className="mb-1 block text-xs font-medium text-muted-foreground"
            htmlFor={`ctx-${filter.id}`}
          >
            {filter.label}
          </label>
          <select
            id={`ctx-${filter.id}`}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {filter.allowAll !== false ? (
              <option value="">{filter.allLabel ?? `All ${filter.label.toLowerCase()}`}</option>
            ) : null}
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {actions ? <div className="ml-auto flex items-end gap-2">{actions}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * ConfirmButton - confirmation flow for destructive / high-impact actions.
 * ------------------------------------------------------------------ */

export interface ConfirmButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
> {
  label: string;
  /** Copy shown in the confirmation step. */
  confirmLabel?: string;
  description?: string;
  onConfirm: () => void;
  icon?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export function ConfirmButton({
  label,
  confirmLabel = 'Confirm',
  description,
  onConfirm,
  icon,
  variant = 'destructive',
  size = 'sm',
  className,
  disabled,
  ...rest
}: ConfirmButtonProps) {
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 6000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  if (armed) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)}>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            setArmed(false);
          }}
          className="rounded-md bg-destructive px-2.5 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
        {description ? <span className="text-xs text-muted-foreground">{description}</span> : null}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setArmed(true)}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        {
          default: 'bg-primary text-primary-foreground hover:bg-primary/90',
          outline: 'border border-input bg-background hover:bg-accent',
          ghost: 'hover:bg-accent hover:text-accent-foreground',
          destructive: 'text-destructive hover:bg-destructive/10',
        }[variant],
        {
          sm: 'h-8 px-2.5',
          md: 'h-9 px-3.5',
          lg: 'h-10 px-5',
        }[size],
        className
      )}
      {...rest}
    >
      {icon ? <NavIcon name={icon} className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}
