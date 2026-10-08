'use client';

/**
 * Settings form primitives.
 *
 * Every settings area in the admin portal is built from these, which is what
 * keeps load/save/error/permission handling identical across eight areas. The
 * API is the authority on every write: `SettingsSection` refuses to render an
 * editor without the declared permission, and the PATCH is re-authorized by
 * `requirePermissions` on the server.
 */

import * as React from 'react';
import { cn } from '@schoolos/utils';
import {
  useAuth,
  SETTINGS_AREA_LABELS,
  SETTINGS_AREA_PERMISSIONS,
  type Permission,
  type SettingsArea,
} from '@schoolos/auth';
import { NavIcon } from './NavIcon';
import { notify } from './Toast';
import { ErrorState, LoadingState, SectionHeader } from './block';
import type { LucideIcon } from 'lucide-react';

/**
 * `SettingsArea` and the area/permission map come from `@schoolos/auth`, which
 * is the same source the API re-exports from. Declaring a local copy here would
 * let the UI offer an area the API refuses.
 */

type SettingsRecord = Record<string, unknown>;

interface SettingsEnvelope<R extends SettingsRecord> {
  area?: string;
  saved?: boolean;
  settings?: R;
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Inline validation message. */
  error?: string;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, error, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(
        'h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-60',
        error ? 'border-destructive focus-visible:ring-destructive/40' : 'border-input',
        className
      )}
      {...props}
    />
  );
});

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { className, error, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(
        'w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground transition-colors',
        'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-60',
        error ? 'border-destructive focus-visible:ring-destructive/40' : 'border-input',
        className
      )}
      {...props}
    />
  );
});

export interface SettingsSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const SettingsSelect = React.forwardRef<HTMLSelectElement, SettingsSelectProps>(
  function SettingsSelect({ className, error, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-10 w-full rounded-md border bg-background px-2.5 text-sm text-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-60',
          error ? 'border-destructive' : 'border-input',
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

/** A labelled switch. `checked` is controlled so the server response can drive it. */
export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-60',
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({ label, hint, required, error, children, className }: FieldProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-destructive" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({
  title,
  description,
  icon: Icon,
  children,
  className,
}: SettingsCardProps) {
  return (
    <section className={cn('rounded-lg border bg-card p-5', className)}>
      <header className="mb-4 flex items-start gap-3">
        {Icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4.5 w-4.5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * SettingsSection
 *
 * Owns loading, dirty tracking, save and error state for one settings area.
 * The render prop receives the current record and a typed setter, so an area
 * only has to describe its fields.
 * ------------------------------------------------------------------ */

export interface SettingsSectionProps<R extends SettingsRecord> {
  area: SettingsArea;
  /**
   * Write permission. Defaults to the area's own write guard from
   * `SETTINGS_AREA_PERMISSIONS`, which mirrors the API route table. Override
   * only when a screen needs something narrower.
   */
  permission?: Permission;
  title: string;
  description?: string;
  children: (value: R, set: <K extends keyof R>(key: K, value: R[K]) => void) => React.ReactNode;
}

interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  message?: string;
}

export function SettingsSection<R extends SettingsRecord>({
  area,
  permission,
  title,
  description,
  children,
}: SettingsSectionProps<R>) {
  const { can } = useAuth();
  const required = permission ?? (SETTINGS_AREA_PERMISSIONS[area].write as Permission);
  const allowed = can(required);

  const [value, setValue] = React.useState<R | null>(null);
  const [baseline, setBaseline] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [save, setSave] = React.useState<SaveState>({ status: 'idle' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/settings/${area}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadError(
          res.status === 403
            ? 'Your role does not hold the permission this area requires.'
            : `The API refused the request (HTTP ${res.status}).`
        );
        return;
      }
      const body = (await res.json()) as SettingsEnvelope<R>;
      const next = (body.settings ?? ({} as R)) as R;
      setValue(next);
      setBaseline(JSON.stringify(next));
    } catch {
      setLoadError('Could not reach the API. Check that it is running.');
    } finally {
      setLoading(false);
    }
  }, [area]);

  React.useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const set = React.useCallback(<K extends keyof R>(key: K, next: R[K]) => {
    setSave({ status: 'idle' });
    setValue((prev) => (prev ? ({ ...prev, [key]: next } as R) : prev));
  }, []);

  const dirty = value !== null && JSON.stringify(value) !== baseline;

  async function persist() {
    if (!value) return;
    setSave({ status: 'saving' });
    try {
      const res = await fetch(`/api/settings/${area}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const message = body?.error?.message ?? `The API rejected the change (HTTP ${res.status}).`;
        setSave({ status: 'error', message });
        notify.error(message);
        return;
      }
      // Re-read rather than trusting local state: the service normalizes and
      // echoes back what was actually persisted.
      const refreshed = (await (
        await fetch(`/api/settings/${area}`, {
          credentials: 'include',
        })
      ).json()) as SettingsEnvelope<R>;
      const next = (refreshed.settings ?? value) as R;
      setValue(next);
      setBaseline(JSON.stringify(next));
      setSave({ status: 'saved' });
      notify.success(`${SETTINGS_AREA_LABELS[area]} settings saved`);
    } catch {
      const message = 'Could not reach the API. Check that it is running.';
      setSave({ status: 'error', message });
      notify.error(message);
    }
  }

  function discard() {
    if (!value) return;
    setValue(JSON.parse(baseline) as R);
    setSave({ status: 'idle' });
  }

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title={title} description={description} />
        <ErrorState
          title="You do not have access to this area"
          message={`Saving ${area} settings requires ${required}. Your role does not hold it, and the API refuses the request independently of this screen.`}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader title={title} description={description} />
        <LoadingState label={`Loading ${area} settings`} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <SectionHeader title={title} description={description} />
        <ErrorState title={`Could not load ${area} settings`} message={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title={title}
        description={description}
        action={
          <div className="flex items-center gap-2">
            {save.status === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600">
                <NavIcon name="check" className="h-4 w-4" />
                Saved
              </span>
            ) : null}
            <button
              type="button"
              onClick={discard}
              disabled={!dirty || save.status === 'saving'}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={persist}
              disabled={!dirty || save.status === 'saving'}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {save.status === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        }
      />

      {save.status === 'error' && save.message ? (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {save.message}
        </div>
      ) : null}

      {value ? children(value, set) : null}
    </div>
  );
}
