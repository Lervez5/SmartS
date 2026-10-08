'use client';

/**
 * Academic session context.
 *
 * Academic session is first-class application context: the navbar selector, the
 * session status pill and every module screen read the same selection.
 *
 * Where the data comes from, and what it honestly can and cannot do today:
 *
 *  - The API has NO AcademicYear or Term model. `SchoolAcademicSettings`
 *    carries a single free-text `currentAcademicYearId`, plus `termsPerYear`.
 *    So there is exactly one session to show, and the selector becomes a real
 *    dropdown only once the model exists.
 *  - Status is DERIVED, never invented: the session matching the school's
 *    configured `currentAcademicYearId` is Active, anything else is Archived.
 *    There is no "Support" term state to reflect because no term model exists.
 *  - Editing is gated on `academics.manage`, so an ACCOUNTANT sees the session
 *    read-only while a DEAN or SUPER_ADMIN can change it.
 *
 * The selection is a UI preference. It is persisted locally for continuity and
 * sent to the API as context wherever a screen supports it; the backend
 * re-authorizes every request regardless of what is selected here.
 */

import * as React from 'react';

export type AcademicSessionStatus = 'active' | 'archived' | 'unset';

export interface AcademicSession {
  id: string;
  label: string;
  status: AcademicSessionStatus;
}

interface AcademicSessionValue {
  sessions: AcademicSession[];
  sessionId: string;
  setSessionId: (id: string) => void;
  current: AcademicSession | null;
  /** The school's configured current session, independent of the selection. */
  configuredId: string | null;
  /** True once the fetch has resolved, so the navbar can avoid a layout shift. */
  ready: boolean;
  /** True when the school has not set a session at all. */
  isUnset: boolean;
  /** Whether the signed-in user may change it. */
  canEdit: boolean;
}

const AcademicSessionContext = React.createContext<AcademicSessionValue | null>(null);

const STORAGE_KEY = 'smarts-academic-session';

/**
 * Derives the session list from the academic settings record.
 *
 * Exported so the shape is testable and so a future AcademicYear model can
 * replace this function without touching any consumer.
 */
export function sessionsFromSettings(
  settings: {
    currentAcademicYearId?: string | null;
    academicYearFormat?: string | null;
    termsPerYear?: number | null;
  } | null
): AcademicSession[] {
  if (!settings) return [];
  const id = (settings.currentAcademicYearId ?? '').trim();
  if (!id) return [];

  const label = (settings.academicYearFormat ?? '').trim() || id;
  return [{ id, label, status: 'active' }];
}

export function AcademicSessionProvider({
  children,
  canEdit,
}: {
  children: React.ReactNode;
  canEdit: boolean;
}) {
  const [sessions, setSessions] = React.useState<AcademicSession[]>([]);
  const [sessionId, setSessionIdState] = React.useState('');
  const [ready, setReady] = React.useState(false);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/settings/academic', {
        credentials: 'include',
        signal,
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        settings?: {
          currentAcademicYearId?: string | null;
          academicYearFormat?: string | null;
          termsPerYear?: number | null;
        } | null;
      };
      setSessions(sessionsFromSettings(body.settings ?? null));
    } catch {
      // A failure leaves the selector empty rather than guessing a session.
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).finally(() => setReady(true));
    return () => controller.abort();
  }, [load]);

  // Adopt the selection once the sessions arrive, preferring a stored choice.
  React.useEffect(() => {
    if (sessions.length === 0) return;
    setSessionIdState((current) => {
      if (current && sessions.some((s) => s.id === current)) return current;
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored && sessions.some((s) => s.id === stored)) return stored;
      } catch {
        // Storage is a convenience; fall through to the configured session.
      }
      return sessions[0].id;
    });
  }, [sessions]);

  const setSessionId = React.useCallback((id: string) => {
    setSessionIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not being able to remember the choice is not an error.
    }
  }, []);

  const value = React.useMemo<AcademicSessionValue>(
    () => ({
      sessions,
      sessionId,
      setSessionId,
      current: sessions.find((s) => s.id === sessionId) ?? null,
      configuredId: sessions[0]?.id ?? null,
      ready,
      isUnset: ready && sessions.length === 0,
      canEdit,
    }),
    [sessions, sessionId, setSessionId, ready, canEdit]
  );

  return (
    <AcademicSessionContext.Provider value={value}>{children}</AcademicSessionContext.Provider>
  );
}

export function useAcademicSession(): AcademicSessionValue {
  const ctx = React.useContext(AcademicSessionContext);
  if (!ctx) {
    throw new Error('useAcademicSession must be used inside <AcademicSessionProvider>');
  }
  return ctx;
}

export function useOptionalAcademicSession(): AcademicSessionValue | null {
  return React.useContext(AcademicSessionContext);
}
