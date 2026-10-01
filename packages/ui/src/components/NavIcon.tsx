'use client';

import {
  LayoutDashboard,
  UserRound,
  Users,
  UsersRound,
  GraduationCap,
  Shapes,
  BookOpen,
  Library,
  ClipboardList,
  ClipboardCheck,
  PenLine,
  Scale,
  TrendingUp,
  CalendarCheck,
  CalendarDays,
  Calendar,
  CalendarRange,
  Megaphone,
  MessageSquare,
  FileBarChart,
  FileCheck,
  FileUp,
  FolderOpen,
  Settings,
  Wallet,
  Receipt,
  CreditCard,
  Banknote,
  Package,
  Bus,
  ScrollText,
  ShieldCheck,
  KeyRound,
  Building,
  Palette,
  Archive,
  MailPlus,
  UserPlus,
  Plus,
  PieChart,
  GitBranch,
  BarChart3,
  LogOut,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  CircleAlert,
  TriangleAlert,
  Check,
  Info,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

/**
 * Icon name to component map for navigation metadata.
 *
 * `navigation.ts` stores icon names as plain strings so it stays free of React
 * and can be imported by the API and by tests. This module is the single place
 * that turns those strings into components, which is what keeps a typo in the
 * registry a visible missing-icon rather than a build failure.
 */
const ICONS: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard,
  'user-round': UserRound,
  'user-plus': UserPlus,
  users: Users,
  'users-round': UsersRound,
  'graduation-cap': GraduationCap,
  shapes: Shapes,
  'book-open': BookOpen,
  library: Library,
  'clipboard-list': ClipboardList,
  'clipboard-check': ClipboardCheck,
  'pen-line': PenLine,
  scale: Scale,
  'trending-up': TrendingUp,
  'calendar-check': CalendarCheck,
  'calendar-days': CalendarDays,
  'calendar-range': CalendarRange,
  calendar: Calendar,
  megaphone: Megaphone,
  'message-square': MessageSquare,
  'file-bar-chart': FileBarChart,
  'file-check': FileCheck,
  'file-up': FileUp,
  'folder-open': FolderOpen,
  settings: Settings,
  wallet: Wallet,
  receipt: Receipt,
  'credit-card': CreditCard,
  banknote: Banknote,
  package: Package,
  bus: Bus,
  'scroll-text': ScrollText,
  'shield-check': ShieldCheck,
  'key-round': KeyRound,
  building: Building,
  palette: Palette,
  archive: Archive,
  'mail-plus': MailPlus,
  plus: Plus,
  'pie-chart': PieChart,
  'git-branch': GitBranch,
  'bar-chart-3': BarChart3,
  'log-out': LogOut,
  bell: Bell,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  menu: Menu,
  'circle-alert': CircleAlert,
  'triangle-alert': TriangleAlert,
  check: Check,
  info: Info,
  search: Search,
  'arrow-up-down': ArrowUpDown,
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  sparkles: Sparkles,
};

export interface NavIconProps {
  /** Icon name as declared in the navigation registry. */
  name?: string;
  className?: string;
  /** Accessible label. When omitted the icon is hidden from assistive tech. */
  label?: string;
}

/** Renders a registry icon by name, falling back to a neutral dot. */
export function NavIcon({ name, className = 'h-4 w-4', label }: NavIconProps) {
  const Icon = name ? ICONS[name] : undefined;
  if (!Icon) {
    return (
      <span
        aria-hidden={label ? undefined : true}
        role={label ? 'img' : undefined}
        aria-label={label}
        className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40 ${className ? '' : ''}`}
        style={{ width: '0.375rem', height: '0.375rem' }}
      />
    );
  }
  return (
    <Icon
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    />
  );
}

export { ICONS as NAV_ICONS };
