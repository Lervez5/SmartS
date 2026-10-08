import { SelectHTMLAttributes } from "react";
import { cn } from "@schoolos/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, className, options, ...props }: SelectProps) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-foreground mb-1">{label}</label>}
      <select
        className={cn(
          "mt-1 block w-full rounded-md border border-input bg-background shadow-sm transition-colors",
          "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-destructive focus:border-destructive focus:ring-destructive/20" : "",
          className || ""
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
