'use client';

import { PortalLayout } from '@schoolos/ui';

/**
 * Authenticated chrome for every signed-in student screen.
 *
 * Mounting the shell once at the route-group root means the dashboard,
 * settings and profile screens all share the same navbar and sidebar, and the
 * navigation is derived from the student's live permission set.
 */
export default function StudentShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout app="student" portalName="Student Portal">
      {children}
    </PortalLayout>
  );
}
