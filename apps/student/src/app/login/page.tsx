'use client';

/**
 * Student portal entry point.
 *
 * Same shared sign-in form and layout as the other portals. Portal eligibility
 * is decided by the backend; this page only authenticates and navigates.
 *
 * The institution's own photograph is shown on the visual panel, read from the
 * public branding endpoint alongside the school name. It is decoration: a
 * failure to load it must not stop the form working.
 */
import * as React from 'react';
import { AuthShell, AuthVisual } from '@schoolos/auth/ui';
import { LoginForm } from '@schoolos/auth';

/** Shape of `GET /api/public/branding`, the unauthenticated sign-in projection. */
interface BrandingResponse {
  displayName?: string | null;
  name?: string | null;
  logoUrl?: string | null;
  /** The institution's photograph, shown on the sign-in panel. */
  coverImageUrl?: string | null;
  coverImageAltText?: string | null;
}

export default function StudentLoginPage() {
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
        // The API may not be running; the form still works.
      }
    })();
    return () => controller.abort();
  }, []);

  const schoolName = branding?.displayName ?? branding?.name ?? null;

  return (
    <AuthShell
      portalLabel={schoolName ? 'Student Portal' : undefined}
      schoolName={schoolName}
      logoUrl={branding?.logoUrl ?? null}
      title="Welcome back"
      description="Sign in to continue to your student portal."
      visual={
        <AuthVisual
          coverImageUrl={branding?.coverImageUrl ?? null}
          coverImageAltText={branding?.coverImageAltText ?? null}
          institutionName={schoolName}
          caption="Sign in to continue."
        />
      }
    >
      <LoginForm
        appId="student"
        schoolName={schoolName ?? undefined}
        forgotPasswordHref="/forgot-password"
      />
    </AuthShell>
  );
}
