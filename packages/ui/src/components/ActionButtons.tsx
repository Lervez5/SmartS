'use client';

/**
 * Inline row actions.
 *
 * A compact, horizontal group of icon buttons for a table row. Preferred over a
 * dropdown where the action set is small and fixed: the affordances stay visible
 * without a click, so an administrator can see what a row can do at a glance
 * rather than discovering it.
 *
 * Every button carries an accessible name and a tooltip, so the action never
 * depends on recognising a glyph. Callers pass only the actions the identity is
 * allowed to perform; this component does not decide permissions itself.
 */
import * as React from 'react';
import { cn } from '@schoolos/utils';
import { NavIcon } from './NavIcon';

export interface ActionButtonItem {
  id: string;
  /** Accessible name and tooltip. Never rely on the icon alone. */
  label: string;
  href?: string;
  icon: string;
  onClick?: () => void;
  /** Destructive entries are tinted; keep them last. */
  tone?: 'default' | 'danger';
  /** Opens in a new tab. */
  external?: boolean;
}

export interface ActionButtonsProps {
  items: ActionButtonItem[];
  className?: string;
}

export function ActionButtons({ items, className }: ActionButtonsProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn('flex items-center justify-end gap-0.5 whitespace-nowrap', className)}
      onClick={(event) => event.stopPropagation()}
      role="group"
    >
      {items.map((item) => {
        const classes = cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          item.tone === 'danger'
            ? 'text-destructive hover:bg-destructive/10'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        );

        const content = <NavIcon name={item.icon} className="h-4 w-4" />;

        if (item.href) {
          return (
            <a
              key={item.id}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className={classes}
            >
              {content}
            </a>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            title={item.label}
            aria-label={item.label}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
