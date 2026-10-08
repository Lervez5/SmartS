'use client';

/**
 * GapScreen - the state a module route renders when its navigation entry
 * exists but the backend capability does not.
 *
 * This is deliberately not an empty table. An empty table reads as "no data
 * yet", which is a lie when the endpoint does not exist. Naming the missing
 * capability keeps the platform honest about what is and is not built, and
 * gives the backend team a precise work item.
 */

import * as React from 'react';
import {
  CBC_GAPS,
  visibleNavItems,
  type AppId,
  type Permission,
  type UserRole,
} from '@schoolos/auth';
import { GapState, SectionHeader } from './block';

export interface GapScreenProps {
  app: AppId;
  path: string;
  permissions: Permission[];
  role: UserRole;
  title: string;
}

export function GapScreen({ app, path, permissions, role, title }: GapScreenProps) {
  const entry = React.useMemo(
    () => visibleNavItems(app, permissions, role).find((item) => item.href === path),
    [app, permissions, role, path]
  );

  const detail =
    entry?.gap ??
    'This capability is defined in the navigation registry but has no backend implementation yet. The route and navigation entry are in place; the API capability is not.';

  return (
    <div className="space-y-6">
      <SectionHeader title={title} />
      <GapState concept={title} detail={detail} />
      <KnownGaps />
    </div>
  );
}

/** Lists every CBC concept the platform is designed for but has not built. */
export function KnownGaps() {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">
        CBC capabilities still to be built
      </h2>
      <p className="text-sm text-muted-foreground">
        The platform is designed to carry these CBC concepts. They are listed here rather than
        stubbed so a navigation item never implies a capability that does not exist behind the API.
      </p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                Concept
              </th>
              <th scope="col" className="px-4 py-3 text-left font-semibold text-muted-foreground">
                What is missing
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {CBC_GAPS.map((gap) => (
              <tr key={gap.concept}>
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  {gap.concept}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{gap.missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
