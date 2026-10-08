'use client';

/**
 * Admin portal entry point.
 *
 * One page serves SUPER_ADMIN, DEAN and ACCOUNTANT. There is no role switch
 * here: the split-screen composition is identical for all three, and what each
 * identity can reach is decided by Central Auth and the backend after sign-in.
 *
 * The badge on the visual panel is a real configured value read from the public
 * branding endpoint, falling back to the school's academic-session string and
 * finally to a static label. No statistics are invented.
 */

import * as React from 'react';
import { AuthShell, AuthVisual } from '@schoolos/auth/ui';
import { LoginForm } from '@schoolos/auth';

/** Shape of `GET /api/public/branding`, the unauthenticated sign-in projection. */
interface BrandingResponse {
  displayName?: string | null;
  name?: string | null;
  curriculum?: string | null;
  logoUrl?: string | null;
  /** A configured academic session, when the school has set one. */
  academicSession?: string | null;
}

export default function AdminLoginPage() {
  const [branding, setBranding] = React.useState<BrandingResponse | null>(null);

  React.useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/public/branding', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!res.ok) return;
        setBranding((await res.json()) as BrandingResponse);
      } catch {
        // Branding is decoration on the login screen. The API may not be
        // running, and the form must still work without it.
      }
    })();

    return () => controller.abort();
  }, []);

  const schoolName = branding?.displayName ?? branding?.name ?? null;
  const curriculum = branding?.curriculum ?? null;
  const session = branding?.academicSession ?? null;

  const badge = React.useMemo(() => {
    if (session) return `${session} Academic Session`;
    if (curriculum) return `${curriculum} School Management`;
    return 'CBC School Management';
  }, [session, curriculum]);

  return (
    <AuthShell
      portalLabel={schoolName ? 'Administrative Portal' : undefined}
      schoolName={schoolName}
      logoUrl={branding?.logoUrl ?? null}
      title="Welcome back"
      description="Manage your school's academic, financial and administrative operations."
      visual={
        <AuthVisual
          badge={badge}
          eyebrow="School Management Platform"
          headline="Everything your school needs, in one place."
          body="Learners, academics, CBC assessment, attendance, finance, staff and administration connected through one secure platform."
          areas={[
            'People',
            'Financials',
            'Administration',
            'Summative Assessments',
            'Smart Lab',
            'Reports',
          ]}
        />
      }
    >
      <LoginForm
        appId="admin"
        schoolName={schoolName ?? undefined}
        forgotPasswordHref="/forgot-password"
      />
    </AuthShell>
  );
}
