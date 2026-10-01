'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isSettingsArea, SETTINGS_AREA_LABELS, SETTINGS_AREAS } from '@schoolos/auth';
import { cn } from '@schoolos/utils';
import {
  ErrorState,
  NavIcon,
  GeneralSettingsSection,
  AcademicSettingsSection,
  FinanceSettingsSection,
  BrandingSettingsSection,
  NotificationsSettingsSection,
  SecuritySettingsSection,
  SubscriptionSettingsSection,
  GlowSettingsSection,
} from '@schoolos/ui';

/**
 * Settings area router.
 *
 * The area list comes from `SETTINGS_AREAS` in `@schoolos/auth` — the same
 * constant the API re-exports — so a screen can never exist for an area the
 * service does not serve. Each area maps to exactly one section component over
 * the `SettingsSection` primitive, which owns load/save/permission handling.
 */
const ICONS: Record<string, string> = {
  general: 'building',
  branding: 'palette',
  academic: 'graduation-cap',
  finance: 'wallet',
  subscription: 'credit-card',
  notifications: 'megaphone',
  glow: 'sparkles',
  security: 'shield-check',
};

export default function AdminSettingsAreaPage() {
  const params = useParams();
  const area = params?.area as string | undefined;

  if (!area || !isSettingsArea(area)) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Settings</h1>
        <ErrorState
          title="Unknown settings area"
          message={`"${area ?? ''}" is not a configuration area this platform serves.`}
        />
        <SettingsNav />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {SETTINGS_AREA_LABELS[area]} Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            School configuration. Changes apply to every portal in the school.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsNav active={area} />
        <div className="min-w-0">
          <AreaSection area={area} />
        </div>
      </div>
    </div>
  );
}

function SettingsNav({ active }: { active?: string }) {
  return (
    <nav aria-label="Settings areas" className="lg:sticky lg:top-4 lg:self-start">
      <ul className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 lg:flex-col lg:overflow-visible">
        {SETTINGS_AREAS.map((area) => {
          const isActive = area === active;
          return (
            <li key={area} className="shrink-0">
              <Link
                href={`/admin/settings/${area}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <NavIcon name={ICONS[area]} className="h-4 w-4" />
                <span className="whitespace-nowrap">{SETTINGS_AREA_LABELS[area]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function AreaSection({ area }: { area: string }) {
  switch (area) {
    case 'general':
      return <GeneralSettingsSection />;
    case 'branding':
      return <BrandingSettingsSection />;
    case 'academic':
      return <AcademicSettingsSection />;
    case 'finance':
      return <FinanceSettingsSection />;
    case 'notifications':
      return <NotificationsSettingsSection />;
    case 'security':
      return <SecuritySettingsSection />;
    case 'subscription':
      return <SubscriptionSettingsSection />;
    case 'glow':
      return <GlowSettingsSection />;
    default:
      return <ErrorState title="Unknown settings area" message={`No section for "${area}".`} />;
  }
}
