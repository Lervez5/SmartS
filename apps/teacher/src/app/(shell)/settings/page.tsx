'use client';

import { ProfileSettingsSection, PersonalSettingsSection, AccountSecuritySettingsSection } from '@schoolos/ui';

export default function TeacherSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      <p className="text-sm text-muted-foreground">Manage your profile, preferences and account security.</p>

      <ProfileSettingsSection />

      <PersonalSettingsSection />

      <AccountSecuritySettingsSection />
    </div>
  );
}
