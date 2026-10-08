'use client';

/**
 * PortalLayout - the single bridge between the auth session and the shell.
 *
 * Each of the four portals mounts this in one place. It reads the identity
 * from the shared auth store, hands the permission set to `AppShell`, resolves
 * the school name and unread notification count, and owns the real logout call
 * (`POST /auth/logout` plus cookie clearing), which the store-only
 * `useAuth().logout` does not do.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { settingsHrefFor, useAuth, useLogout, type AppId, type UserRole } from '@schoolos/auth';
import { AppShell } from './AppShell';
import { BrandLoader } from './BrandLoader';
import { ErrorState, LoadingState } from './block';

/**
 * Shape of `GET /api/settings/branding`.
 *
 * Wrapped in `settings` like every other configuration area, so the shell and
 * the settings screens share one contract. `school` is tolerated so a nested
 * shape would still resolve rather than silently falling back to the platform
 * mark.
 */
interface BrandingEnvelope {
  settings?: {
    logoUrl?: string | null;
    portalNameOverride?: string | null;
    displayName?: string | null;
    name?: string | null;
  } | null;
}

/** Shape of `GET /api/settings/general`, used for the support channel. */
interface GeneralSettingsResponse {
  settings?: { email?: string | null; phone?: string | null } | null;
}

export interface PortalLayoutProps {
  app: AppId;
  portalName: string;
  children: React.ReactNode;
  /** Strip rendered between the navbar and the main region. */
  toolbar?: React.ReactNode;
  /** Overrides the branding resolved from the API. */
  schoolName?: string;
  logoUrl?: string;
  /**
   * Support channel. Defaults to the school's configured official email as a
   * `mailto:` link, and the navbar hides the entry when the school has not
   * configured one - rather than pointing at a help desk that does not exist.
   */
  supportHref?: string | null;
}

/** Resolves the school's real branding for the navbar and sidebar. */
function useBranding(enabled: boolean) {
  const [branding, setBranding] = React.useState<BrandingEnvelope['settings'] | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/settings/branding', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as BrandingEnvelope;
        setBranding(body.settings ?? null);
      } catch {
        // The shell falls back to a neutral mark rather than a hardcoded name.
      }
    })();

    return () => controller.abort();
  }, [enabled]);

  return branding;
}

/** Resolves the school's real support channel from the general settings. */
function useSupportHref(enabled: boolean, override?: string | null) {
  const [href, setHref] = React.useState<string | null>(override ?? null);

  React.useEffect(() => {
    if (override !== undefined) {
      setHref(override);
      return;
    }
    if (!enabled) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/settings/general', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as GeneralSettingsResponse;
        const email = body.settings?.email?.trim();
        setHref(email ? `mailto:${email}` : null);
      } catch {
        setHref(null);
      }
    })();

    return () => controller.abort();
  }, [enabled, override]);

  return href;
}

/** Unread notification count for the navbar bell. */
function useUnreadCount(enabled: boolean) {
  const [count, setCount] = React.useState<number | undefined>(undefined);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/notifications', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          notifications?: Array<{ id: string; read?: boolean }>;
          unread?: number;
        };
        if (typeof data.unread === 'number') {
          setCount(data.unread);
        } else if (Array.isArray(data.notifications)) {
          setCount(data.notifications.filter((n) => n.read === false).length);
        }
      } catch {
        // A missing bell is preferable to a broken shell.
      }
    })();

    return () => controller.abort();
  }, [enabled]);

  return count;
}

export function PortalLayout({
  app,
  portalName,
  children,
  toolbar,
  schoolName,
  logoUrl,
  supportHref,
}: PortalLayoutProps) {
  const { user, permissions, isAuthenticated, isResolving } = useAuth();
  const logoutAndRedirect = useLogout();
  const router = useRouter();
  const branding = useBranding(isAuthenticated);
  const resolvedSupport = useSupportHref(isAuthenticated, supportHref);
  const unread = useUnreadCount(isAuthenticated);

  React.useEffect(() => {
    if (!isResolving && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isResolving, isAuthenticated, router]);

  if (isResolving) {
    return <BrandLoader portalName={portalName} label="Preparing your workspace…" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <ErrorState
          title="Session expired"
          message="You are not signed in. Sign in again to continue."
          onRetry={() => router.replace('/login')}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  return (
    <AppShell
      app={app}
      role={user.role as UserRole}
      permissions={permissions}
      user={{
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        role: user.role,
      }}
      portalName={portalName}
      settingsHref={settingsHrefFor(app, permissions, user.role as UserRole)}
      logoUrl={logoUrl ?? branding?.logoUrl ?? null}
      schoolName={
        schoolName ??
        branding?.portalNameOverride ??
        branding?.displayName ??
        branding?.name ??
        null
      }
      supportHref={resolvedSupport}
      notificationCount={unread}
      onLogout={logoutAndRedirect}
      toolbar={toolbar}
    >
      {children}
    </AppShell>
  );
}
