'use client';

import * as React from 'react';
import { SettingsCard, Field, TextInput, notify } from '@schoolos/ui';

export function AccountSecuritySettingsSection() {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [revoking, setRevoking] = React.useState(false);

  async function changePassword() {
    setError(null);
    setSaved(false);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const message = body?.error?.message ?? `Update failed (HTTP ${res.status}).`;
        setError(message);
        notify.error(message);
        return;
      }
      setSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      notify.success('Password updated');
    } catch {
      const message = 'Could not reach the API. Check that it is running.';
      setError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function revokeSessions() {
    setRevoking(true);
    try {
      const res = await fetch('/auth/revoke-sessions', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const message = body?.error?.message ?? `Request failed (HTTP ${res.status}).`;
        notify.error(message);
        return;
      }
      notify.success('All other sessions have been signed out');
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Password"
        description="Change your password. You will need your current password to continue."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Field label="Current password">
            <TextInput
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password" hint="At least 8 characters">
            <TextInput
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm new password">
            <TextInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={changePassword}
            disabled={saving}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving ? 'Updating…' : 'Update password'}
          </button>
          {saved ? <span className="text-sm text-emerald-600">Password updated</span> : null}
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}
      </SettingsCard>

      <SettingsCard
        title="Sessions"
        description="Manage your active sessions and signed-in devices."
      >
        <p className="text-sm text-muted-foreground">
          Revoke all sessions to sign out every device except the current browser. You will stay
          signed in here.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={revokeSessions}
            disabled={revoking}
            className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3.5 text-sm font-medium transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
          >
            {revoking ? 'Signing out…' : 'Sign out all other sessions'}
          </button>
        </div>
      </SettingsCard>
    </div>
  );
}
