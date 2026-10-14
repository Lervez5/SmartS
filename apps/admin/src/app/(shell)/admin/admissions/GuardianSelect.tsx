'use client';

import * as React from 'react';
import { ChevronDown, Info, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react';
import { Button, Input, Modal, TextInput } from '@schoolos/ui';

/**
 * A guardian as the enrollment module reports it. Every field here comes from
 * `GET /api/parents`, so the selector never invents a second kind of person:
 * a "Dean" guardian is the same User record the staff module reads.
 */
export interface GuardianOption {
  id: string;
  userId: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone: string | null;
  avatar: string | null;
  accountStatus?: string;
  isStaff?: boolean;
  staff?: { position: string | null; department: string | null; status: string } | null;
  roles?: string[];
  childCount?: number;
  children?: Array<{
    linkId: string;
    learnerId: string;
    name: string;
    email: string;
    gradeLevel: string | null;
  }>;
}

function guardianName(g: GuardianOption): string {
  return g.name ?? [g.firstName, g.lastName].filter(Boolean).join(' ') ?? g.email;
}

/** Roles that are worth badging in a picker, in the order an admin scans them. */
const NOTABLE_ROLES = ['SUPER_ADMIN', 'DEAN', 'ACCOUNTANT', 'TEACHER'] as const;

/**
 * A guardian is more than a name in the picker: the same account is often a
 * member of staff or an administrator, and the selector needs to show that at
 * the moment of choosing rather than after the learner has been linked.
 */
export interface GuardianSelectProps {
  value: string;
  onChange: (userId: string) => void;
  options: GuardianOption[];
  label?: string;
  hint?: string;
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
}

export function GuardianSelect({
  value,
  onChange,
  options,
  label,
  hint,
  emptyLabel = 'No guardian yet',
  disabled,
  id,
}: GuardianSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [detailsFor, setDetailsFor] = React.useState<GuardianOption | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(
    () => options.find((option) => option.userId === value) ?? null,
    [options, value]
  );

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => {
      const haystack = [
        guardianName(option),
        option.email,
        option.phone ?? '',
        option.staff?.position ?? '',
        ...(option.roles ?? []),
        ...(option.children ?? []).map((child) => `${child.name} ${child.email}`),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [options, query]);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label
          className="mb-1.5 block text-sm font-medium text-foreground"
          htmlFor={id ?? 'guardian-select-trigger'}
        >
          {label}
        </label>
      ) : null}

      <button
        type="button"
        id={id ?? 'guardian-select-trigger'}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? (
            <>
              <GuardianAvatar guardian={selected} />
              <span className="truncate">{guardianName(selected)}</span>
              <GuardianBadges guardian={selected} />
            </>
          ) : (
            <span className="truncate text-muted-foreground">{emptyLabel}</span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {selected ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear guardian"
              title="Clear guardian"
              onClick={(event) => {
                event.stopPropagation();
                onChange('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange('');
                }
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <TextInput
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search guardians by name, email, phone, role or learner…"
                className="h-9 pl-8 text-sm"
              />
            </div>
          </div>

          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
              >
                {emptyLabel}
              </button>
            </li>
            {filtered.map((option) => (
              <li key={option.userId} className="flex items-center gap-1 pr-2 hover:bg-muted">
                <button
                  type="button"
                  role="option"
                  aria-selected={option.userId === value}
                  onClick={() => {
                    onChange(option.userId);
                    setOpen(false);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm ${
                    option.userId === value ? 'font-medium text-foreground' : 'text-foreground'
                  }`}
                >
                  <GuardianAvatar guardian={option} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate">{guardianName(option)}</span>
                      <GuardianBadges guardian={option} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {option.email}
                      {option.phone ? ` · ${option.phone}` : ''}
                    </span>
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`View details for ${guardianName(option)}`}
                  title="Guardian details"
                  onClick={() => setDetailsFor(option)}
                  className="h-7 w-7 shrink-0 p-0"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                No guardian matches that search.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}

      <Modal
        isOpen={Boolean(detailsFor)}
        onClose={() => setDetailsFor(null)}
        title="Guardian Details"
        size="md"
      >
        {detailsFor ? (
          <GuardianDetails guardian={detailsFor} onClose={() => setDetailsFor(null)} />
        ) : null}
      </Modal>
    </div>
  );
}

function GuardianAvatar({ guardian }: { guardian: GuardianOption }) {
  if (guardian.avatar) {
    return (
      <span
        role="img"
        aria-label=""
        className="h-7 w-7 shrink-0 rounded-full bg-cover bg-center"
        style={{ backgroundImage: `url(${guardian.avatar})` }}
      />
    );
  }
  const initials = guardianName(guardian)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
      {initials || '?'}
    </span>
  );
}

/**
 * Badges a guardian carries into the picker. Staff and role badges matter most:
 * choosing a guardian who is also a Dean changes who the school is granting
 * visibility to, and that should be visible before the choice is made.
 */
function GuardianBadges({ guardian }: { guardian: GuardianOption }) {
  const notable = (guardian.roles ?? []).filter((role) =>
    (NOTABLE_ROLES as readonly string[]).includes(role)
  );

  return (
    <span className="flex shrink-0 items-center gap-1">
      {notable.map((role) => (
        <span
          key={role}
          title={`${roleLabel(role)} account`}
          className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700"
        >
          <ShieldCheck className="h-3 w-3" />
          {roleLabel(role)}
        </span>
      ))}
      {guardian.isStaff && !notable.length ? (
        <span
          title={guardian.staff?.position ?? 'School staff'}
          className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700"
        >
          <UserRound className="h-3 w-3" />
          Staff
        </span>
      ) : null}
      {(guardian.childCount ?? guardian.children?.length ?? 0) > 0 ? (
        <span
          title={
            guardian.children?.length
              ? guardian.children.map((child) => child.name).join(', ')
              : `${guardian.childCount} linked learner(s)`
          }
          className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700"
        >
          <Users className="h-3 w-3" />
          {guardian.childCount ?? guardian.children?.length ?? 0}
        </span>
      ) : null}
    </span>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    SUPER_ADMIN: 'Admin',
    DEAN: 'Dean',
    ACCOUNTANT: 'Accountant',
    TEACHER: 'Teacher',
    PARENT: 'Parent',
    STUDENT: 'Student',
  };
  return labels[role] ?? role;
}

/** The relationship behind a guardian link, shown when details are opened. */
function GuardianDetails({ guardian, onClose }: { guardian: GuardianOption; onClose: () => void }) {
  const children = guardian.children ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
        <GuardianAvatar guardian={guardian} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{guardianName(guardian)}</p>
          <p className="truncate text-xs text-muted-foreground">{guardian.email}</p>
        </div>
        <GuardianBadges guardian={guardian} />
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-muted-foreground">Phone</dt>
          <dd className="text-foreground">{guardian.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-muted-foreground">Account</dt>
          <dd className="text-foreground">{guardian.accountStatus ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-muted-foreground">Roles</dt>
          <dd className="text-foreground">
            {guardian.roles?.length ? guardian.roles.join(', ') : 'Guardian only'}
          </dd>
        </div>
        {guardian.isStaff ? (
          <div>
            <dt className="text-xs font-medium uppercase text-muted-foreground">Staff role</dt>
            <dd className="text-foreground">
              {[guardian.staff?.position, guardian.staff?.department].filter(Boolean).join(' · ') ||
                'Staff record on file'}
            </dd>
          </div>
        ) : null}
      </dl>

      <div>
        <p className="text-xs font-medium uppercase text-muted-foreground">Relationship</p>
        {children.length > 0 ? (
          <ul className="mt-1 divide-y divide-border rounded-md border">
            {children.map((child) => (
              <li
                key={child.linkId}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-foreground">{child.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {child.email}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {child.gradeLevel ? `Guardian · ${child.gradeLevel}` : 'Guardian'}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            No learners linked yet. Links are made by email from the learner record.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
