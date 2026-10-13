'use client';

import { cn } from '@schoolos/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Button.
 *
 * Variants carry depth rather than only a fill colour, because a flat
 * colour-swap button reads as a placeholder: the elevation says "this is the
 * thing you press", and the press state confirms it was pressed.
 *
 * The elevation tokens are the ones the design system already defines - the
 * `--shadow-*` custom properties - so buttons darken and lift in step with
 * cards and modals instead of each surface deciding on its own how much depth
 * it has.
 *
 * `translate-y` on press is deliberate: it is the cue that the control
 * registered the click, and it reads as physical on a button far more than a
 * colour change alone.
 */
export function Button({ className, variant = 'default', size = 'md', ...props }: ButtonProps) {
  const variantClasses = {
    // A one-step gradient and a brand-tinted shadow give the primary action an
    // obvious weight without a second colour in the palette.
    default:
      'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-[var(--shadow-brand)] ' +
      'hover:from-primary/95 hover:to-primary/85 hover:shadow-[var(--shadow-lg)]',
    outline:
      'border border-input bg-card text-foreground shadow-[var(--shadow-sm)] ' +
      'hover:border-primary/40 hover:bg-accent hover:shadow-[var(--shadow-md)]',
    ghost: 'text-foreground hover:bg-accent hover:text-accent-foreground',
    destructive:
      'bg-gradient-to-b from-destructive to-destructive/90 text-destructive-foreground shadow-[var(--shadow-sm)] ' +
      'hover:from-destructive/95 hover:to-destructive/80 hover:shadow-[var(--shadow-md)]',
  };

  const sizeClasses = {
    sm: 'h-9 px-3',
    md: 'h-10 px-4 py-2',
    lg: 'h-11 px-8',
  };

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md text-sm font-semibold',
        'transition-[color,background-color,border-color,box-shadow,transform] duration-150',
        // The press state: a pixel of travel and a smaller shadow, so the click
        // is felt rather than merely registered.
        'active:translate-y-px active:shadow-[var(--shadow-sm)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
