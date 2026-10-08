'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarRange, ChevronDown, LifeBuoy, LogOut, Menu } from 'lucide-react';
import { cn } from '@schoolos/utils';
import {
  visibleSections,
  visibleQuickActions,
  primaryActionFor,
  type NavItemLike,
  type NavSectionResult,
  type QuickAction,
  type Permission,
  type UserRole,
  type AppId,
} from '@schoolos/auth';
import { NavIcon } from './NavIcon';
import { BrandMark } from './BrandMark';
import { ThemeToggle } from './ThemeToggle';
import {
  AcademicSessionProvider,
  useAcademicSession,
  type AcademicSession,
} from './AcademicSession';
import { StatusPill } from './block';

/* ------------------------------------------------------------------ *
 * UserMenu - avatar, name, role, account status, settings, logout.
 * ------------------------------------------------------------------ */

export interface ShellUser {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  avatar?: string;
}

export interface UserMenuProps {
  user: ShellUser;
  /** Account status as reported by the session, e.g. "active" / "pending". */
  accountStatus?: string;
  onLogout: () => void;
  /**
   * Account settings route for THIS portal. Resolved by the caller from the
   * navigation registry: the admin portal serves it at `/admin/settings`, the
   * other three at `/settings`.
   */
  settingsHref: string;
  className?: string;
}

export function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

export function roleLabel(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Closes a popover on outside click and Escape. Shared by the nav popovers. */
function useDismiss(open: boolean, close: () => void) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return ref;
}

export function UserMenu({
  user,
  accountStatus,
  onLogout,
  settingsHref,
  className,
}: UserMenuProps) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const containerRef = useDismiss(open, close);

  const displayName =
    user.name ?? [user.firstName, user.lastName].filter(Boolean).join(' ') ?? user.email;

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
          {user.avatar ? (
            <span
              role="img"
              aria-label=""
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${user.avatar})` }}
            />
          ) : (
            initialsFor(displayName || user.email)
          )}
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[150px] truncate text-sm font-semibold text-foreground">
            {displayName || user.email}
          </span>
          <span className="block text-xs text-muted-foreground">{roleLabel(user.role)}</span>
        </span>
        <NavIcon name="chevron-down" className="hidden h-4 w-4 text-muted-foreground sm:block" />
        <span className="sr-only">Open account menu</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="border-b px-4 py-3">
            <p className="truncate text-sm font-semibold">{displayName || user.email}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill label={roleLabel(user.role)} tone="brand" />
              {accountStatus ? (
                <StatusPill
                  label={accountStatus}
                  tone={accountStatus === 'active' ? 'success' : 'warning'}
                />
              ) : null}
            </div>
          </div>
          <div className="p-1">
            <Link
              href={settingsHref}
              role="menuitem"
              onClick={close}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <NavIcon name="settings" className="h-4 w-4 text-muted-foreground" />
              Settings &amp; Security
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                close();
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <NavIcon name="log-out" className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * QuickActions - generated from the identity's permissions.
 * ------------------------------------------------------------------ */

const GROUP_LABEL: Record<string, string> = {
  create: 'Create',
  record: 'Record',
  review: 'Review',
  engage: 'Communicate',
};

export function QuickActions({
  actions,
  className,
}: {
  actions: QuickAction[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const containerRef = useDismiss(open, close);

  if (actions.length === 0) return null;

  const grouped = actions.reduce<Record<string, QuickAction[]>>((acc, action) => {
    (acc[action.group] ??= []).push(action);
    return acc;
  }, {});

  return (
    <div className={cn('relative', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NavIcon name="plus" className="h-4 w-4" />
        <span className="hidden sm:inline">Quick Actions</span>
        <span className="sm:hidden">Actions</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="border-b last:border-b-0">
              <p className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {GROUP_LABEL[group] ?? group}
              </p>
              <div className="p-1">
                {items.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    role="menuitem"
                    onClick={close}
                    title={action.implemented === false ? action.gap : undefined}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <NavIcon
                      name={action.icon ?? 'plus'}
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <span className="truncate">{action.label}</span>
                    {action.implemented === false ? (
                      <StatusPill label="Soon" tone="warning" className="ml-auto" />
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Sidebar
 * ------------------------------------------------------------------ */

export function NavItemLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItemLike;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? '';
  const isActive =
    item.href === pathname || (item.href !== '/' && pathname.startsWith(`${item.href}/`));

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        collapsed && 'justify-center px-0',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <NavIcon name={item.icon} className="h-4 w-4 shrink-0" />
      {collapsed ? (
        <span className="sr-only">{item.label}</span>
      ) : (
        <span className="truncate">{item.label}</span>
      )}
      {item.implemented === false && !collapsed ? (
        <span
          className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
          aria-label="Backend capability pending"
        />
      ) : null}
    </Link>
  );
}

export function SidebarSection({
  section,
  collapsed,
  onNavigate,
}: {
  section: NavSectionResult;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="py-1">
      {collapsed ? (
        <div className="mx-2 my-2 h-px bg-border" aria-hidden />
      ) : (
        <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          {section.label}
        </p>
      )}
      <nav className="space-y-0.5" aria-label={section.label}>
        {section.items.map((item) => (
          <NavItemLink key={item.id} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}

export interface SidebarProps {
  sections: NavSectionResult[];
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  portalName: string;
  logoUrl?: string | null;
  schoolName?: string | null;
  /**
   * Signs the user out through the API and returns to the portal's sign-in
   * page. This is `useLogout()`, not the store's `clearSession`, so it revokes
   * the refresh token server-side rather than only dropping local state.
   */
  onLogout: () => void;
}

export function Sidebar({
  sections,
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
  portalName,
  logoUrl,
  schoolName,
  onLogout,
}: SidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh shrink-0 flex-col border-r bg-card',
          'transition-[width,transform] duration-200 lg:static lg:h-auto lg:translate-x-0',
          collapsed ? 'w-[68px]' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Main navigation"
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b px-3',
            collapsed && 'justify-center px-0'
          )}
        >
          <BrandMark
            logoUrl={logoUrl}
            schoolName={schoolName}
            portalName={portalName}
            size="sm"
            markOnly={collapsed}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
          {sections.map((section) => (
            <SidebarSection
              key={section.id}
              section={section}
              collapsed={collapsed}
              onNavigate={onMobileClose}
            />
          ))}
        </div>

        <div className="hidden shrink-0 space-y-0.5 border-t p-2 lg:block">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <NavIcon
              name={collapsed ? 'chevron-right' : 'chevron-left'}
              className="h-4 w-4 shrink-0"
            />
            {collapsed ? <span className="sr-only">Expand sidebar</span> : <span>Collapse</span>}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium',
              'text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              collapsed && 'justify-center px-0'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {collapsed ? <span className="sr-only">Sign out</span> : <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

/* ------------------------------------------------------------------ *
 * TopNavbar
 * ------------------------------------------------------------------ */

export interface TopNavbarProps {
  /** Real school branding, from SchoolBrandingSettings and School. */
  logoUrl?: string | null;
  schoolName?: string | null;
  portalName: string;
  /** Portal-specific account settings route. */
  settingsHref: string;
  user: ShellUser;
  accountStatus?: string;
  onLogout: () => void;
  quickActions: QuickAction[];
  /** Where a learner or staff member asks for help. Renders only if set. */
  supportHref?: string | null;
  onMobileMenu: () => void;
  notificationCount?: number;
  notificationsHref?: string;
}

export function TopNavbar({
  logoUrl,
  schoolName,
  portalName,
  settingsHref,
  user,
  accountStatus,
  onLogout,
  quickActions,
  supportHref,
  onMobileMenu,
  notificationCount,
  notificationsHref,
}: TopNavbarProps) {
  const { sessions, sessionId, setSessionId, current, ready, isUnset, canEdit } =
    useAcademicSession();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      {/* ---------- Zone 1: brand, anchored left ---------- */}
      <div className="flex min-w-0 shrink items-center gap-2">
        <button
          type="button"
          onClick={onMobileMenu}
          aria-label="Open navigation"
          className="-ml-1.5 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          <Menu className="h-[22px] w-[22px]" />
        </button>

        <BrandMark
          logoUrl={logoUrl}
          schoolName={schoolName}
          portalName={portalName}
          size="sm"
          className="hidden sm:flex"
        />
        <BrandMark
          logoUrl={logoUrl}
          schoolName={schoolName}
          size="sm"
          markOnly
          className="sm:hidden"
        />
      </div>

      {/* ---------- Zone 2: academic context, centred ---------- */}
      <div className="hidden min-w-0 flex-1 items-center justify-center gap-2 md:flex">
        <AcademicSessionControl
          sessions={sessions}
          sessionId={sessionId}
          onChange={setSessionId}
          current={current}
          ready={ready}
          isUnset={isUnset}
          canEdit={canEdit}
        />
        {supportHref ? <SupportLink href={supportHref} /> : null}
      </div>

      {/* ---------- Zone 3: actions and user, anchored right ---------- */}
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
        {typeof notificationCount === 'number' ? (
          <a
            href={notificationsHref}
            aria-label={`Notifications${notificationCount > 0 ? `, ${notificationCount} unread` : ''}`}
            className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Bell className="h-5 w-5" />
            {notificationCount > 0 ? (
              <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            ) : null}
          </a>
        ) : null}

        <ThemeToggle />

        <QuickActions actions={quickActions} />

        <div className="mx-0.5 hidden h-6 w-px bg-border sm:block" aria-hidden />

        <UserMenu
          user={user}
          accountStatus={accountStatus}
          onLogout={onLogout}
          settingsHref={settingsHref}
        />
      </div>
    </header>
  );
}

/**
 * Academic session selector and status.
 *
 * Read-only unless the caller holds `academics.manage`. When the school has not
 * configured a session it says so and links to the setting rather than
 * displaying a fabricated year.
 */
function AcademicSessionControl({
  sessions,
  sessionId,
  onChange,
  current,
  ready,
  isUnset,
  canEdit,
}: {
  sessions: AcademicSession[];
  sessionId: string;
  onChange: (id: string) => void;
  current: AcademicSession | null;
  ready: boolean;
  isUnset: boolean;
  canEdit: boolean;
}) {
  if (!ready) {
    // Reserve the row's width so the centred zone does not jump once loaded.
    return <div className="h-10 w-44 rounded-md border border-input/60" aria-hidden />;
  }

  if (isUnset) {
    return (
      <a
        href="/admin/settings/academic"
        className="inline-flex h-10 items-center gap-2 rounded-md border border-dashed border-input px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CalendarRange className="h-4 w-4" />
        No academic session set
        {canEdit ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : null}
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {canEdit && sessions.length > 1 ? (
        <>
          <label className="sr-only" htmlFor="academic-session">
            Academic session
          </label>
          <select
            id="academic-session"
            value={sessionId}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 max-w-[210px] truncate rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.label}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span className="inline-flex h-10 max-w-[240px] items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{current?.label ?? sessionId}</span>
        </span>
      )}

      {current ? (
        <StatusPill
          label={current.status}
          tone={current.status === 'active' ? 'success' : 'neutral'}
        />
      ) : null}
    </div>
  );
}

/** Support entry. Only rendered when the school has a real support channel. */
function SupportLink({ href }: { href: string }) {
  const external = href.startsWith('http') || href.startsWith('mailto:');
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="inline-flex h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <LifeBuoy className="h-4 w-4" />
      Support
    </a>
  );
}

/* ------------------------------------------------------------------ *
 * AppShell
 *
 * The one application chrome all four portals mount. Navigation, quick actions
 * and the contextual primary action are all derived from the central registry
 * using the authenticated permission set, so no portal maintains its own
 * permission logic.
 * ------------------------------------------------------------------ */

export interface AppShellProps {
  app: AppId;
  role: UserRole;
  permissions: Permission[];
  user: ShellUser;
  accountStatus?: string;
  /** Real branding from School / SchoolBrandingSettings. */
  logoUrl?: string | null;
  schoolName?: string | null;
  portalName: string;
  /** Portal-specific account settings route, from settingsHrefFor(app). */
  settingsHref: string;
  /** Real support channel. Omit to hide the Support entry. */
  supportHref?: string | null;
  notificationCount?: number;
  onLogout: () => void;
  /** Rendered between the navbar and the main region. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export function AppShell({
  app,
  role,
  permissions,
  user,
  accountStatus,
  logoUrl,
  schoolName,
  portalName,
  settingsHref,
  supportHref,
  notificationCount,
  onLogout,
  toolbar,
  children,
}: AppShellProps) {
  return (
    <AcademicSessionProvider canEdit={permissions.includes('academics.manage')}>
      <ShellFrame
        app={app}
        role={role}
        permissions={permissions}
        user={user}
        accountStatus={accountStatus}
        logoUrl={logoUrl}
        schoolName={schoolName}
        portalName={portalName}
        settingsHref={settingsHref}
        supportHref={supportHref}
        notificationCount={notificationCount}
        onLogout={onLogout}
        toolbar={toolbar}
      >
        {children}
      </ShellFrame>
    </AcademicSessionProvider>
  );
}

/** Inner component: safe to consume the academic session context it sits under. */
function ShellFrame({
  app,
  role,
  permissions,
  user,
  accountStatus,
  logoUrl,
  schoolName,
  portalName,
  settingsHref,
  supportHref,
  notificationCount,
  onLogout,
  toolbar,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname() ?? '/';

  const sections = React.useMemo(
    () => visibleSections(app, permissions, role),
    [app, permissions, role]
  );
  const quickActions = React.useMemo(
    () => visibleQuickActions(app, permissions, role),
    [app, permissions, role]
  );
  const action = React.useMemo(
    () => primaryActionFor(pathname, permissions, role),
    [pathname, permissions, role]
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        sections={sections}
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        portalName={portalName}
        logoUrl={logoUrl}
        schoolName={schoolName}
        onLogout={onLogout}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNavbar
          logoUrl={logoUrl}
          schoolName={schoolName}
          portalName={portalName}
          settingsHref={settingsHref}
          user={user}
          accountStatus={accountStatus}
          onLogout={onLogout}
          quickActions={quickActions}
          supportHref={supportHref}
          onMobileMenu={() => setMobileOpen(true)}
          notificationCount={notificationCount}
        />
        {toolbar ? (
          <div className="shrink-0 border-b bg-background px-4 py-3">{toolbar}</div>
        ) : null}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          {action ? <ModulePrimaryAction action={action} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Contextual primary action for the current module.
 *
 * Rendered above the page content rather than in the navbar, so the navbar's
 * three zones stay stable while each module supplies its own action. Gated by
 * `primaryActionFor`, which returns null unless the caller holds the permission.
 */
function ModulePrimaryAction({
  action,
}: {
  action: NonNullable<ReturnType<typeof primaryActionFor>>;
}) {
  return (
    <div className="mb-4 flex justify-end">
      <a
        href={action.href}
        title={action.implemented === false ? action.gap : undefined}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NavIcon name={action.icon ?? 'plus'} className="h-4 w-4" />
        {action.label}
      </a>
    </div>
  );
}
