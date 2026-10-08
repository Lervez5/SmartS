'use client';

import * as React from 'react';
import { useAuth } from '@schoolos/auth';
import { SettingsCard, Field, TextInput, notify } from '@schoolos/ui';

export function ProfileSettingsSection() {
  const { user, setSession } = useAuth();
  const [name, setName] = React.useState(user?.name ?? '');
  const [firstName, setFirstName] = React.useState(user?.firstName ?? '');
  const [lastName, setLastName] = React.useState(user?.lastName ?? '');
  const [email, setEmail] = React.useState(user?.email ?? '');
  const [phone, setPhone] = React.useState(user?.phone ?? '');
  const [avatar, setAvatar] = React.useState(user?.avatar ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function persist() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, firstName, lastName, avatar, phone }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        const message = body?.error?.message ?? `Update failed (HTTP ${res.status}).`;
        setError(message);
        notify.error(message);
        return;
      }
      const body = (await res.json()) as { user: { id: string; name?: string; email: string; firstName?: string; lastName?: string; avatar?: string; phone?: string; role: string } };
      if (user) {
        setSession({
          ...user,
          name: body.user.name,
          email: body.user.email,
          firstName: body.user.firstName,
          lastName: body.user.lastName,
          avatar: body.user.avatar,
          phone: body.user.phone,
        });
      }
      setSaved(true);
      notify.success('Profile updated');
    } catch {
      const message = 'Could not reach the API. Check that it is running.';
      setError(message);
      notify.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard title="Profile" description="Your identity in the platform. Only you and authorized staff can see these details.">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="Full name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
        </Field>
        <Field label="Email" required>
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="First name" hint="Optional">
          <TextInput value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
        </Field>
        <Field label="Last name" hint="Optional">
          <TextInput value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
        </Field>
        <Field label="Phone" hint="Optional">
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000000" />
        </Field>
        <Field label="Avatar URL" hint="Optional">
          <TextInput value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://..." />
        </Field>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={persist}
          disabled={saving}
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {saved ? <span className="text-sm text-emerald-600">Saved</span> : null}
      </div>

      {error ? (
        <div role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </SettingsCard>
  );
}
