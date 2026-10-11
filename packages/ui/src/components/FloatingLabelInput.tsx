'use client';

import React, { useId } from 'react';
import { cn } from '@schoolos/utils';

export interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ className, label, error, helperText, icon, id, placeholder = ' ', ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1">
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors pointer-events-none z-10">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            placeholder={placeholder}
            className={cn(
              'peer flex h-13 w-full rounded-xl border border-input/80 bg-background/80 backdrop-blur-xs px-3.5 pt-4 pb-1.5 text-sm font-medium text-foreground transition-all duration-200 outline-none',
              'hover:border-primary/40 focus:border-primary focus:ring-4 focus:ring-primary/15 focus:bg-background',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-10',
              error && 'border-destructive focus:border-destructive focus:ring-destructive/15',
              className
            )}
            {...props}
          />
          <label
            htmlFor={inputId}
            className={cn(
              'absolute text-xs font-semibold text-muted-foreground transition-all duration-200 pointer-events-none z-10 origin-top-left',
              'peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:translate-y-0',
              'peer-focus:text-xs peer-focus:font-semibold peer-focus:-translate-y-2.5 peer-focus:text-primary',
              '-translate-y-2.5',
              icon ? 'left-10 peer-placeholder-shown:left-10 peer-focus:left-10' : 'left-3.5',
              error && 'text-destructive peer-focus:text-destructive'
            )}
          >
            {label}
          </label>
        </div>
        {error ? (
          <p className="text-xs font-medium text-destructive animate-fade-in pl-1">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-muted-foreground pl-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

FloatingLabelInput.displayName = 'FloatingLabelInput';
