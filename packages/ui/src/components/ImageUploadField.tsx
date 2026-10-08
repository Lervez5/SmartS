'use client';

/**
 * Branding image upload.
 *
 * Posts the file to the branding upload endpoint and reports the stored URL back
 * through `onChange`, so the field is saved with the rest of the area rather
 * than being a separate upload the caller has to reconcile. The school is
 * resolved from the caller's membership server-side, so one institution cannot
 * write under another's prefix.
 *
 * The browser is checked before uploading as well, but only as a courtesy: the
 * endpoint re-validates type and size, because a client-side check is advice,
 * not a control.
 */

import * as React from 'react';
import { cn } from '@schoolos/utils';
import { notify } from './Toast';

export type BrandingImageKind = 'logo' | 'favicon' | 'cover';

export interface ImageUploadFieldProps {
  label: string;
  hint?: string;
  /** Which branding image this is, sent as `kind`. */
  kind: BrandingImageKind;
  /** Currently stored URL, empty when none is set. */
  value: string;
  /** Alt text is configured separately, so it is not managed here. */
  altText?: string;
  onChange: (url: string) => void;
  /** Square for logos and favicons, wide for a photograph. */
  shape?: 'square' | 'wide';
  disabled?: boolean;
  className?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon';

export function ImageUploadField({
  label,
  hint,
  kind,
  value,
  altText,
  onChange,
  shape = 'wide',
  disabled,
  className,
}: ImageUploadFieldProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);

  async function upload(file: File) {
    if (!file.type.startsWith('image/')) {
      notify.error('That file is not an image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      notify.error('The image must be 5 MB or smaller.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(
        `/api/uploads/branding?kind=${kind}&filename=${encodeURIComponent(file.name)}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': file.type },
          body: file,
        }
      );

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        notify.error(body?.error?.message ?? `Upload failed (HTTP ${res.status}).`);
        return;
      }

      const stored = (await res.json()) as { url: string };
      onChange(stored.url);
      notify.success(`${label} uploaded`);
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !disabled) void upload(file);
  }

  return (
    <div className={cn('space-y-2', className)}>
      <span className="block text-sm font-medium text-foreground">{label}</span>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex items-center gap-4 rounded-lg border border-dashed p-4 transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-input',
          disabled ? 'opacity-60' : ''
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center overflow-hidden border bg-muted text-[10px] font-medium uppercase text-muted-foreground',
            shape === 'square' ? 'h-14 w-14 rounded-lg' : 'h-16 w-24 rounded-md'
          )}
        >
          {value ? (
            <img src={value} alt={altText || label} className="h-full w-full object-cover" />
          ) : (
            'None'
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || busy}
              className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            </button>

            {value ? (
              <>
                <a
                  href={value}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                >
                  View
                </a>
                <button
                  type="button"
                  onClick={() => onChange('')}
                  disabled={disabled || busy}
                  className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Remove
                </button>
              </>
            ) : null}
          </div>

          <p className="mt-1 text-xs text-muted-foreground">
            Drag a file here, or choose one. PNG, JPEG or WebP up to 5 MB.
          </p>
          {value ? (
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{value}</p>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            // Allow re-picking the same file after a removal.
            event.target.value = '';
          }}
        />
      </div>

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
