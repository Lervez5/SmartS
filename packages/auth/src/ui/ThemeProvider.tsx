'use client';

/**
 * Root theme provider.
 *
 * `next-themes` is already a dependency of every portal but was never mounted,
 * so the `.dark` token block in `globals.css` had no way to be applied. The
 * class strategy is the one the stylesheet already implements - the tokens are
 * declared under `.dark { ... }`, not a `prefers-color-scheme` media query.
 *
 * `defaultTheme="system"` with `enableSystem` means a visitor without a stored
 * preference still gets the correct palette, and the navbar toggle writes an
 * explicit choice over the top of it.
 */

import * as React from 'react';
import { ThemeProvider as NextThemeProvider } from 'next-themes';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemeProvider>
  );
}
