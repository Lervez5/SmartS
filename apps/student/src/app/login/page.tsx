'use client';

import * as React from 'react';
import { AuthShell } from '@schoolos/auth/ui';
import { LoginForm } from '@schoolos/auth';

/**
 * Student portal entry point.
 *
 * Same shared sign-in form and layout as the other portals. Portal eligibility
 * is decided by the backend; this page only authenticates and navigates.
 */
export default function StudentLoginPage() {
  const [schoolName, setSchoolName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/public/branding', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          displayName?: string | null;
          name?: string | null;
        };
        setSchoolName(data.displayName ?? data.name ?? null);
      } catch {
        // The API may not be running; the form still works.
      }
    })();
    return () => controller.abort();
  }, []);

  return (
    <AuthShell
      portalLabel={schoolName ? 'Student Portal' : undefined}
      schoolName={schoolName}
      title="Welcome back"
      description="Sign in to continue to your Student portal."
    >
      <LoginForm
        appId="student"
        schoolName={schoolName ?? undefined}
        forgotPasswordHref="/forgot-password"
      />
    </AuthShell>
  );
}
