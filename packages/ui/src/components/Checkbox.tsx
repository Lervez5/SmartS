import { InputHTMLAttributes } from "react";
import { cn } from "@schoolos/utils";

export interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Checkbox({ label, error, className, ...props }: CheckboxProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center">
        <input
          type="checkbox"
          className={cn(
            "h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary/30",
            "disabled:cursor-not-allowed disabled:opacity-50",
            error ? "border-destructive" : "",
            className || ""
          )}
          {...props}
        />
        {label && <label className="ml-2 block text-sm text-foreground">{label}</label>}
      </div>
      {error && <p className="text-sm text-destructive mt-1">{error}</p>}
    </div>
  );
}
