import { cn } from '@schoolos/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      // The design system's elevation token rather than Tailwind's default, so a
      // card's depth matches the tokens the rest of the surfaces use.
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-[var(--shadow-sm)]',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn('flex flex-col space-y-2 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-6 pt-0', className)} {...props} />;
}
