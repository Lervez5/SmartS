'use client';

/**
 * Row action menu.
 *
 * A learner row supports more than two contextual actions, and inline buttons
 * crowd the table at every breakpoint, so they collapse into one icon trigger
 * that opens a menu. Every entry is a real destination the caller has already
 * permission-checked; this component only renders what it is given.
 *
 * The trigger carries an icon and an accessible label. Each entry carries an
 * icon and a visible label, so the meaning never depends on recognising a glyph.
 */
import * as React from 'react';
import { cn } from '@schoolos/utils';
import { NavIcon } from './NavIcon';

export interface ActionMenuItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  /** Destructive entries are tinted and separated. */
  tone?: 'default' | 'danger';
  /** Explains an entry that is reachable but not yet functional. */
  title?: string;
  /** Opens in a new tab, e.g. a report in a separate view. */
  external?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Accessible label for the trigger, e.g. "Actions for Sam Student". */
  label: string;
  className?: string;
}

export function ActionMenu({ items, label, className }: ActionMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // A row's menu must not also trigger the row's click handler.
  function stopAndRun(action: () => void) {
    return (event: React.MouseEvent) => {
      event.stopPropagation();
      action();
    };
  }

  if (items.length === 0) return null;

  const defaultItems = items.filter((item) => item.tone !== 'danger');
  const dangerItems = items.filter((item) => item.tone === 'danger');

  const renderItem = (item: ActionMenuItem) => (
    <a
      key={item.id}
      href={item.href}
      role="menuitem"
      title={item.title}
      {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
      onClick={stopAndRun(() => setOpen(false))}
      className={cn(
        'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        item.tone === 'danger'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-accent'
      )}
    >
      <NavIcon name={item.icon} className="h-4 w-4 shrink-0 opacity-70" />
      <span className="truncate">{item.label}</span>
    </a>
  );

  return (
    <div className={cn('relative inline-block text-left', className)} ref={ref}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        title={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <NavIcon name="more-horizontal" className="h-4 w-4" />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {defaultItems.length > 0 ? (
            <div className="space-y-0.5">{defaultItems.map(renderItem)}</div>
          ) : null}
          {dangerItems.length > 0 ? (
            <>
              {defaultItems.length > 0 ? (
                <div className="my-1 h-px bg-border" role="separator" />
              ) : null}
              <div className="space-y-0.5">{dangerItems.map(renderItem)}</div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
