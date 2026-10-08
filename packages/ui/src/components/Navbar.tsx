'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@schoolos/utils';

export interface NavbarProps {
  showSearch?: boolean;
  navbarActions?: ReactNode;
}

export function Navbar({ showSearch = false, navbarActions }: NavbarProps) {
  return (
    <header className="absolute top-0 left-0 right-0 z-50 flex h-16 items-center justify-between px-6 border-b border-slate-200/50 dark:border-slate-800/50 bg-background/70 backdrop-blur-xl">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-lg">S</span>
        </div>
        <span className="font-black text-xl text-slate-900 dark:text-white">Sprout</span>
      </Link>

      <div className="flex items-center gap-4">
        {showSearch && (
          <div className="relative hidden md:block">
            <input
              type="search"
              placeholder="Search…"
              className="w-64 rounded-full border border-slate-200 dark:border-slate-800 bg-muted px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
        {navbarActions}
      </div>
    </header>
  );
}
