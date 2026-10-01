'use client';

/**
 * Centralized auth client.
 *
 * This is the only place the four applications talk to the auth endpoints.
 * There is no per-app auth service, and tokens are never handled here: the API
 * issues them as httpOnly cookies, so the browser cannot read them.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export interface SessionUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: string;
  permissions?: string[];
  appId: string;
}

export interface SessionResponse {
  user: SessionUser;
}

export interface InvitationSummary {
  id: string;
  email: string;
  role: string;
  name?: string;
  status: string;
  token?: string;
}

const credentials = { credentials: 'include' as const };

/** The API reports errors as { error: { message } }; older routes used { message }. */
export function errorMessage(err: unknown, fallback: string): string {
  const anyErr = err as {
    response?: { data?: { error?: { message?: string }; message?: string } };
    message?: string;
  };
  return (
    anyErr?.response?.data?.error?.message ??
    anyErr?.response?.data?.message ??
    anyErr?.message ??
    fallback
  );
}

export const authClient = {
  /** Establishes identity. Sets the session cookies server-side. */
  async login(payload: { email: string; password: string }): Promise<SessionResponse> {
    const res = await fetch(`${API_URL}/auth/login`, {
      ...credentials,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  },

  /** Current identity, role and permissions from the session cookie. */
  async me(): Promise<SessionResponse> {
    const res = await fetch(`${API_URL}/auth/me`, {
      ...credentials,
      cache: 'no-store',
    });
    if (!res.ok) throw await toError(res);
    return res.json();
  },

  async logout(): Promise<void> {
    await fetch(`${API_URL}/auth/logout`, { ...credentials, method: 'POST' });
  },

  /** Issues a reset link. Always resolves so the UI cannot enumerate accounts. */
  async forgotPassword(email: string): Promise<void> {
    const res = await fetch(`${API_URL}/auth/forgot-password`, {
      ...credentials,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw await toError(res);
  },

  async resetPassword(payload: { token: string; password: string }): Promise<void> {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      ...credentials,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await toError(res);
  },

  /** Validates a provisioned user's invitation before showing the form. */
  async validateInvitation(token: string): Promise<InvitationSummary> {
    const res = await fetch(`${API_URL}/invitations/validate/${token}`, {
      ...credentials,
      cache: 'no-store',
    });
    if (!res.ok) throw await toError(res);
    const data = await res.json();
    return (data.invitation ?? data) as InvitationSummary;
  },

  /** A provisioned user sets their password and becomes active. */
  async activateAccount(payload: { token: string; password: string }): Promise<void> {
    const res = await fetch(`${API_URL}/invitations/activate`, {
      ...credentials,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw await toError(res);
  },

  /** Verifies a token before showing the reset form. */
  async verifyResetToken(token: string): Promise<void> {
    const res = await fetch(`${API_URL}/auth/verify-reset-token`, {
      ...credentials,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) throw await toError(res);
  },
};

async function toError(res: Response): Promise<Error> {
  try {
    const data = await res.json();
    return new Error(data?.error?.message ?? data?.message ?? `Request failed (${res.status})`);
  } catch {
    return new Error(`Request failed (${res.status})`);
  }
}
