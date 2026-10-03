'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  ActionButtons,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PrimaryActionButton,
  SectionHeader,
  StatusPill,
  initialsOf,
  type DataTableColumn,
} from '@schoolos/ui';

/**
 * Parents and guardians.
 *
 * Reads `GET /api/parents`, which is gated by `parents.view` and joins each
 * ParentProfile to its Central Auth account and its linked learners.
 *
 * Affiliation shows the linked learners because that is the relationship
 * information the model holds. `ParentChildLink` carries no relationship-type
 * field, so there is no mother/father/guardian label to show - inventing one
 * would be a fiction the database cannot back up.
 */
interface LinkedLearner {
  linkId: string;
  learnerId: string;
  name: string;
  email: string;
  gradeLevel?: string | null;
}

interface Guardian {
  id: string;
  userId: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  accountStatus: string;
  createdAt: string;
  children: LinkedLearner[];
}

interface ParentsResponse {
  parents?: Guardian[];
}

function displayName(guardian: Guardian): string {
  return guardian.name ?? [guardian.firstName, guardian.lastName].filter(Boolean).join(' ') ?? '';
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminParentsPage() {
  const { can } = useAuth();
  const allowed = can('parents.view');

  const [query, setQuery] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [sort, setSort] = React.useState('name_asc');

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Resolved by the API so the directory stays authoritative.
  const params = new URLSearchParams({ sort });
  if (debounced) params.set('search', debounced);
  params.set('limit', '200');

  const { data, loading, error } = useApi<ParentsResponse>(
    allowed ? `/api/parents?${params.toString()}` : '/api/parents?denied=1'
  );

  const guardians = React.useMemo(() => data?.parents ?? [], [data]);

  const total = guardians.length;
  const linked = guardians.filter((g) => g.children.length > 0).length;
  const unlinked = guardians.filter((g) => g.children.length === 0).length;
  const learners = guardians.reduce((sum, g) => sum + g.children.length, 0);
  const withoutPhone = guardians.filter((g) => !g.phone).length;

  const columns: Array<DataTableColumn<Guardian>> = [
    {
      id: 'profile',
      header: 'Guardian Profile',
      cell: (row) => {
        const name = displayName(row);
        return (
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">
              {row.avatar ? (
                <span
                  role="img"
                  aria-label=""
                  className="h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${row.avatar})` }}
                />
              ) : (
                initialsOf(name || row.email)
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{name || 'Unnamed'}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.children.length === 0 ? (
                  'No linked learners'
                ) : (
                  <>
                    {row.children.length === 1
                      ? '1 linked learner'
                      : `${row.children.length} linked learners`}
                  </>
                )}
              </p>
            </div>
          </div>
        );
      },
      sortValue: (row) => displayName(row),
    },
    {
      id: 'contact',
      header: 'Contact Info',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-foreground">{row.email}</p>
          {row.phone ? (
            <p className="truncate text-xs text-muted-foreground">{row.phone}</p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">No phone on file</p>
          )}
        </div>
      ),
      sortValue: (row) => row.email,
    },
    {
      id: 'affiliation',
      header: 'Affiliation',
      cell: (row) =>
        row.children.length === 0 ? (
          <span className="text-sm text-muted-foreground">Not linked to a learner</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.children.slice(0, 3).map((child) => (
              <span
                key={child.linkId}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
                title={child.email}
              >
                {child.name}
                {child.gradeLevel ? (
                  <span className="text-muted-foreground">· {child.gradeLevel}</span>
                ) : null}
              </span>
            ))}
            {row.children.length > 3 ? (
              <span className="text-xs text-muted-foreground">+{row.children.length - 3} more</span>
            ) : null}
          </div>
        ),
      sortValue: (row) => row.children.map((c) => c.name).join(', '),
    },
    {
      id: 'created',
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
      sortValue: (row) => row.createdAt,
    },
  ];

  if (!allowed) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Parents" />
        <ErrorState
          title="You do not have access to guardian records"
          message="Viewing guardians requires parents.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Parents"
        description={`Parent and guardian records, and the learners each is linked to. ${total === 1 ? '1 guardian' : `${total} guardians`} on the directory.`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {can('users.import') ? (
              <PrimaryActionButton
                href="/admin/imports"
                label="Import Parents"
                icon="file-up"
                variant="outline"
                title="Bulk guardian provisioning is not implemented. That screen states what is missing."
              />
            ) : null}
            {can('parents.manage') ? (
              <PrimaryActionButton
                href="/admin/parents/new"
                label="Add Parent"
                icon="user-plus"
                title="Attaches a guardian profile to an existing account via POST /api/parents."
              />
            ) : null}
          </div>
        }
      />

      {loading ? (
        <LoadingState label="Loading guardians" />
      ) : error ? (
        <ErrorState
          title="Could not load guardians"
          message="GET /api/parents requires parents.view. Confirm the API is running and that your session still holds the permission."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              title="Guardians"
              value={total}
              icon="users"
              tone="accent"
              description={debounced ? 'Matching the current search' : 'Every guardian record'}
            />
            <DashboardCard
              title="Linked to learners"
              value={linked}
              icon="graduation-cap"
              tone={unlinked > 0 ? 'warning' : 'success'}
              description={`${unlinked} with no learner`}
            />
            <DashboardCard
              title="Learner links"
              value={learners}
              icon="link"
              description="Guardian to learner relationships"
            />
            <DashboardCard
              title="Missing phone"
              value={withoutPhone}
              icon="circle-alert"
              tone={withoutPhone > 0 ? 'warning' : 'success'}
              description="No phone number on the account"
            />
          </div>

          <DataTable
            caption="Parent and guardian records with their linked learners"
            columns={columns}
            rows={guardians}
            rowKey={(row) => row.id}
            pageSize={15}
            onRowClick={(row) => {
              window.location.href = `/admin/parents/${row.id}`;
            }}
            renderRowActions={(row) => (
              <ActionButtons
                items={[
                  {
                    id: 'view',
                    label: `View guardian profile for ${displayName(row) || row.email}`,
                    href: `/admin/parents/${row.id}`,
                    icon: 'eye',
                  },
                  // Only a holder of parents.manage is offered linking or
                  // unlinking; the endpoint enforces the same permission.
                  ...(can('parents.manage')
                    ? [
                        {
                          id: 'link',
                          label:
                            row.children.length === 0
                              ? `Link a learner to ${displayName(row) || row.email}`
                              : `Manage linked learners for ${displayName(row) || row.email}`,
                          href: `/admin/parents/${row.id}#linked-learners`,
                          icon: 'link',
                        },
                      ]
                    : []),
                  // The account itself, not the profile: identity lives there.
                  {
                    id: 'account',
                    label: `Open account for ${displayName(row) || row.email}`,
                    href: '/admin/users',
                    icon: 'user-round',
                  },
                ]}
              />
            )}
            toolbar={
              <ContextFilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  placeholder: 'Search by name, email or phone…',
                }}
                filters={[
                  {
                    id: 'sort',
                    label: 'Sort by',
                    value: sort,
                    options: [
                      { value: 'name_asc', label: 'Name (A–Z)' },
                      { value: 'name_desc', label: 'Name (Z–A)' },
                      { value: 'newest', label: 'Recently added' },
                      { value: 'oldest', label: 'First added' },
                    ],
                    onChange: setSort,
                    allowAll: false,
                  },
                ]}
              />
            }
            empty={
              <EmptyState
                title={total === 0 && !debounced ? 'No guardians yet' : 'No guardians match'}
                description={
                  total === 0 && !debounced
                    ? 'Add a guardian, then link them to the learners they look after.'
                    : 'Adjust the search or sorting above.'
                }
                icon="users"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            A guardian is a Central Auth account carrying a parent profile, so name, email, phone
            and sign-in status are the account&rsquo;s. The relationship to a learner is the link
            itself: the model records which learners a guardian is linked to, but not a mother,
            father or guardian-type label, so none is shown here.
          </p>
        </>
      )}
    </div>
  );
}
