'use client';

import {
  ProfileSettingsSection,
  PersonalSettingsSection,
  AccountSecuritySettingsSection,
} from '@schoolos/ui';

export default function AdminProfilePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">My Profile</h1>
      <p className="text-sm text-muted-foreground">
        Manage your identity, preferences and account security.
      </p>

      <ProfileSettingsSection />

      <PersonalSettingsSection />

      <AccountSecuritySettingsSection />
    </div>
  );
}
