'use client';

import { PortalLayout } from '@schoolos/ui';

/**
 * Authenticated chrome for every signed-in teacher portal screen.
 *
 * The shell is mounted once at the route-group root, so every module screen
 * shares the same navbar and sidebar, and the navigation is derived from the
 * signed-in identity's live permission set rather than a hand-written list.
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalLayout app="teacher" portalName="Teacher Portal">
      {children}
    </PortalLayout>
  );
}
