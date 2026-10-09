'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { SettingsCard, Field, SettingsSelect, Toggle } from '../SettingsForm';
import { SectionHeader } from '../block';
import { notify } from '../Toast';
import { cn } from '@schoolos/utils';

export interface PersonalSettings {
  theme: string;
  language: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  pushNotifications: boolean;
  inAppNotifications: boolean;
  marketingOptIn: boolean;
  profileVisibility: string;
  teachingPreferences?: string;
  communicationPreferences?: string;
  learningPreferences?: string;
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
  { value: 'sw', label: 'Swahili' },
];

const TIMEZONES = [
  { value: 'Africa/Nairobi', label: 'East Africa Time (EAT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
];

const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
];

const CURRENCIES = [
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown) => v === true;

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MonitorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', Icon: SunIcon },
  { value: 'dark', label: 'Dark', Icon: MoonIcon },
  { value: 'system', label: 'System', Icon: MonitorIcon },
] as const;

function ThemeSelector({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      {THEME_OPTIONS.map(({ value: optionValue, label, Icon }) => {
        const isActive = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-all duration-150',
              isActive
                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                : 'border-input/80 text-muted-foreground hover:border-primary/40 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PersonalSettingsSection() {
  const { setTheme } = useTheme();
  const [value, setValue] = React.useState<PersonalSettings | null>(null);
  const [baseline, setBaseline] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [save, setSave] = React.useState<{
    status: 'idle' | 'saving' | 'saved' | 'error';
    message?: string;
  }>({ status: 'idle' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/settings/personal', { credentials: 'include' });
      if (!res.ok) {
        setLoadError(`The API refused the request (HTTP ${res.status}).`);
        return;
      }
      const body = (await res.json()) as { settings?: PersonalSettings };
      const next = (body.settings ?? {}) as PersonalSettings;
      setValue(next);
      setBaseline(JSON.stringify(next));
      if (next.theme) {
        setTheme(next.theme);
      }
    } catch {
      setLoadError('Could not reach the API. Check that it is running.');
    } finally {
      setLoading(false);
    }
  }, [setTheme]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const set = React.useCallback(
    <K extends keyof PersonalSettings>(key: K, next: PersonalSettings[K]) => {
      setSave({ status: 'idle' });
      setValue((prev) => (prev ? ({ ...prev, [key]: next } as PersonalSettings) : prev));
    },
    []
  );

  const dirty = value !== null && JSON.stringify(value) !== baseline;

  async function persist() {
    if (!value) return;
    setSave({ status: 'saving' });
    try {
      const res = await fetch('/api/settings/personal', {
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
      const refreshed = (await (
        await fetch('/api/settings/personal', { credentials: 'include' })
      ).json()) as { settings?: PersonalSettings };
      const next = (refreshed.settings ?? value) as PersonalSettings;
      setValue(next);
      setBaseline(JSON.stringify(next));
      setSave({ status: 'saved' });
      notify.success('Preferences saved');
    } catch {
      const message = 'Could not reach the API. Check that it is running.';
      setSave({ status: 'error', message });
      notify.error(message);
    }
  }

  function discard() {
    if (!value) return;
    setValue(JSON.parse(baseline) as PersonalSettings);
    setSave({ status: 'idle' });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Preferences"
          description="Your personal preferences across the platform."
        />
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading preferences…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Preferences"
          description="Your personal preferences across the platform."
        />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Preferences"
          description="Your personal preferences across the platform."
        />
        <p className="text-sm text-muted-foreground">No preferences found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Preferences"
        description="Your personal preferences across the platform."
        action={
          <div className="flex items-center gap-2">
            {save.status === 'saved' ? (
              <span className="inline-flex items-center gap-1 text-sm text-emerald-600">Saved</span>
            ) : null}
            <button
              type="button"
              onClick={discard}
              disabled={!dirty || save.status === 'saving'}
              className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={persist}
              disabled={!dirty || save.status === 'saving'}
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
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

      <div className="space-y-6">
        <SettingsCard title="Appearance" description="Choose how the platform looks for you.">
          <Field label="Theme">
            <ThemeSelector
              value={str(value.theme)}
              onChange={(next) => {
                setTheme(next);
                set('theme', next);
              }}
            />
          </Field>
        </SettingsCard>

        <SettingsCard title="Regional" description="Language, time zone and formatting.">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Language">
              <SettingsSelect
                value={str(value.language)}
                onChange={(e) => set('language', e.target.value)}
              >
                <option value="">Default</option>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </SettingsSelect>
            </Field>
            <Field label="Timezone">
              <SettingsSelect
                value={str(value.timezone)}
                onChange={(e) => set('timezone', e.target.value)}
              >
                <option value="">Default</option>
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </SettingsSelect>
            </Field>
            <Field label="Date format">
              <SettingsSelect
                value={str(value.dateFormat)}
                onChange={(e) => set('dateFormat', e.target.value)}
              >
                <option value="">Default</option>
                {DATE_FORMATS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </SettingsSelect>
            </Field>
            <Field label="Currency">
              <SettingsSelect
                value={str(value.currency)}
                onChange={(e) => set('currency', e.target.value)}
              >
                <option value="">Default</option>
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </SettingsSelect>
            </Field>
          </div>
        </SettingsCard>

        <SettingsCard title="Notifications" description="Choose what you receive and how.">
          <div className="space-y-1">
            <Toggle
              label="Email notifications"
              checked={bool(value.emailNotifications)}
              onChange={(checked) => set('emailNotifications', checked)}
            />
            <Toggle
              label="SMS notifications"
              checked={bool(value.smsNotifications)}
              onChange={(checked) => set('smsNotifications', checked)}
            />
            <Toggle
              label="Push notifications"
              checked={bool(value.pushNotifications)}
              onChange={(checked) => set('pushNotifications', checked)}
            />
            <Toggle
              label="In-app notifications"
              checked={bool(value.inAppNotifications)}
              onChange={(checked) => set('inAppNotifications', checked)}
            />
            <Toggle
              label="Marketing emails"
              checked={bool(value.marketingOptIn)}
              onChange={(checked) => set('marketingOptIn', checked)}
            />
          </div>
        </SettingsCard>

        <SettingsCard title="Privacy" description="Control who can see your profile.">
          <Field label="Profile visibility">
            <SettingsSelect
              value={str(value.profileVisibility)}
              onChange={(e) => set('profileVisibility', e.target.value)}
            >
              <option value="private">Private</option>
              <option value="school">School only</option>
              <option value="public">Public</option>
            </SettingsSelect>
          </Field>
        </SettingsCard>

        <SettingsCard title="Preferences" description="Optional notes about how you work best.">
          <div className="space-y-5">
            <Field label="Teaching preferences" hint="Optional">
              <textarea
                value={value.teachingPreferences ?? ''}
                onChange={(e) => set('teachingPreferences', e.target.value || undefined)}
                className="w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2.5 text-sm font-medium text-foreground transition-all duration-200 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                rows={3}
              />
            </Field>
            <Field label="Communication preferences" hint="Optional">
              <textarea
                value={value.communicationPreferences ?? ''}
                onChange={(e) => set('communicationPreferences', e.target.value || undefined)}
                className="w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2.5 text-sm font-medium text-foreground transition-all duration-200 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                rows={3}
              />
            </Field>
            <Field label="Learning preferences" hint="Optional">
              <textarea
                value={value.learningPreferences ?? ''}
                onChange={(e) => set('learningPreferences', e.target.value || undefined)}
                className="w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2.5 text-sm font-medium text-foreground transition-all duration-200 placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15"
                rows={3}
              />
            </Field>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
