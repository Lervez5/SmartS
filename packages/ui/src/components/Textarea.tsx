import { TextareaHTMLAttributes } from "react";
import { cn } from "@schoolos/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaProps) {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-medium text-foreground mb-1">{label}</label>}
      <textarea
        className={cn(
          "mt-1 block w-full rounded-md border border-input bg-background shadow-sm transition-colors",
          "placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-destructive focus:border-destructive focus:ring-destructive/20" : "",
          className || ""
        )}
        {...props}
      />
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
