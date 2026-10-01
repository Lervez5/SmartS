'use client';

/**
 * The academic context store.
 *
 * Academic year and term are first-class application context, not page-local
 * state. Any screen can read the current selection, and switching it must not
 * change who you are or what you may see - authorization is resolved from the
 * session on every request, never from this store.
 *
 * The values here are UI context only. The backend validates any academic
 * year, term, grade, class or learning area identifier it is given.
 */

import * as React from 'react';

export interface AcademicYearOption {
  id: string;
  label: string;
  /** Optional ISO date so the UI can show the span. */
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}

export interface TermOption {
  id: string;
  academicYearId: string;
  label: string;
  termNumber?: number;
  isCurrent?: boolean;
}

interface AcademicContextValue {
  years: AcademicYearOption[];
  terms: TermOption[];
  academicYearId: string;
  termId: string;
  setAcademicYearId: (id: string) => void;
  setTermId: (id: string) => void;
  currentYear: AcademicYearOption | null;
  currentTerm: TermOption | null;
  /** Terms belonging to the selected year. */
  termsForSelectedYear: TermOption[];
  setYears: (years: AcademicYearOption[]) => void;
  setTerms: (terms: TermOption[]) => void;
  ready: boolean;
}

const AcademicContext = React.createContext<AcademicContextValue | null>(null);

const STORAGE_KEY = 'smarts-academic-context';

export function AcademicYearProvider({
  children,
  defaultYearId,
  defaultTermId,
  initialYears = [],
  initialTerms = [],
}: {
  children: React.ReactNode;
  defaultYearId?: string;
  defaultTermId?: string;
  initialYears?: AcademicYearOption[];
  initialTerms?: TermOption[];
}) {
  const [years, setYears] = React.useState<AcademicYearOption[]>(initialYears);
  const [terms, setTerms] = React.useState<TermOption[]>(initialTerms);
  const [academicYearId, setAcademicYearIdState] = React.useState(defaultYearId ?? '');
  const [termId, setTermIdState] = React.useState(defaultTermId ?? '');
  const [ready, setReady] = React.useState(false);

  // Adopt options supplied after mount (they arrive from the API), without
  // clobbering a selection the user already made.
  React.useEffect(() => {
    setYears(initialYears);
  }, [initialYears]);
  React.useEffect(() => {
    setTerms(initialTerms);
  }, [initialTerms]);

  // Rehydrate after mount: the server has no localStorage, so reading it during
  // render would make the first client render disagree with the server markup.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          academicYearId?: string;
          termId?: string;
        };
        if (parsed.academicYearId) setAcademicYearIdState(parsed.academicYearId);
        if (parsed.termId) setTermIdState(parsed.termId);
      }
    } catch {
      // A malformed snapshot must never block the shell from rendering.
    }
    setReady(true);
  }, []);

  const persist = React.useCallback((nextYearId: string, nextTermId: string) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ academicYearId: nextYearId, termId: nextTermId })
      );
    } catch {
      // Storage is a convenience; losing it is not an error.
    }
  }, []);

  const setAcademicYearId = React.useCallback(
    (id: string) => {
      setAcademicYearIdState(id);
      // Changing the year invalidates the term selection, so clear it rather
      // than leaving a term from another year active.
      setTermIdState('');
      persist(id, '');
    },
    [persist]
  );

  const setTermId = React.useCallback(
    (id: string) => {
      setTermIdState(id);
      persist(academicYearId, id);
    },
    [persist, academicYearId]
  );

  const currentYear = React.useMemo(
    () => years.find((y) => y.id === academicYearId) ?? null,
    [years, academicYearId]
  );

  const currentTerm = React.useMemo(
    () => terms.find((t) => t.id === termId) ?? null,
    [terms, termId]
  );

  const termsForSelectedYear = React.useMemo(
    () => (academicYearId ? terms.filter((t) => t.academicYearId === academicYearId) : []),
    [terms, academicYearId]
  );

  const value = React.useMemo<AcademicContextValue>(
    () => ({
      years,
      terms,
      academicYearId,
      termId,
      setAcademicYearId,
      setTermId,
      currentYear,
      currentTerm,
      termsForSelectedYear,
      setYears,
      setTerms,
      ready,
    }),
    [
      years,
      terms,
      academicYearId,
      termId,
      setAcademicYearId,
      setTermId,
      currentYear,
      currentTerm,
      termsForSelectedYear,
      ready,
    ]
  );

  return <AcademicContext.Provider value={value}>{children}</AcademicContext.Provider>;
}

export function useAcademicContext(): AcademicContextValue {
  const ctx = React.useContext(AcademicContext);
  if (!ctx) {
    throw new Error('useAcademicContext must be used inside <AcademicYearProvider>');
  }
  return ctx;
}

/**
 * Non-throwing variant for components that may render outside the shell, such
 * as the login page.
 */
export function useOptionalAcademicContext(): AcademicContextValue | null {
  return React.useContext(AcademicContext);
}
