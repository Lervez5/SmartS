'use client';

/**
 * Small, permission-aware action link used in page headers.
 *
 * Deliberately an anchor rather than a router link: these navigate across
 * module boundaries, and a plain anchor keeps the browser's own behaviour for
 * middle-click and "open in new tab".
 */
export interface PrimaryActionButtonProps {
  href: string;
  label: string;
  icon?: string;
  variant?: 'default' | 'outline' | 'ghost';
  /** Explains an action that is reachable but not yet functional. */
  title?: string;
  className?: string;
}

export function PrimaryActionButton({
  href,
  label,
  icon,
  variant = 'default',
  title,
  className,
}: PrimaryActionButtonProps) {
  return (
    <a
      href={href}
      title={title}
      className={[
        'inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
        variant === 'outline' &&
          'border border-input bg-background text-foreground hover:bg-accent',
        variant === 'ghost' && 'text-muted-foreground hover:bg-accent hover:text-foreground',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon ? (
        <span aria-hidden className="inline-flex">
          <NavGlyph name={icon} />
        </span>
      ) : null}
      {label}
    </a>
  );
}

/**
 * Minimal inline glyph for header actions.
 *
 * The shell's `NavIcon` map lives in the same package but is sized for
 * navigation; this keeps header actions visually identical without coupling the
 * two components.
 */
function NavGlyph({ name }: { name: string }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'h-4 w-4',
  };

  switch (name) {
    case 'user-plus':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </svg>
      );
    case 'file-up':
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5M12 3v12" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5M12 15V3" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
