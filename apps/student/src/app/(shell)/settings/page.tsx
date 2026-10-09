'use client';

import { useAuth } from '@schoolos/auth';
import {
  ProfileSettingsSection,
  PersonalSettingsSection,
  AccountSecuritySettingsSection,
} from '@schoolos/ui';

export default function StudentSettingsPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      <p className="text-sm text-muted-foreground">
        Manage your profile, preferences and account security.
      </p>

      <ProfileSettingsSection />

      <PersonalSettingsSection />

      <AccountSecuritySettingsSection />
    </div>
  );
}
