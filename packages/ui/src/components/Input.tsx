import { cn } from '@schoolos/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10.5 w-full rounded-xl border border-input/80 bg-background/80 backdrop-blur-xs px-3.5 py-2 text-sm font-medium text-foreground transition-all duration-200',
        'placeholder:text-muted-foreground/70 hover:border-primary/40 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}
