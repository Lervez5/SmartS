'use client';

import { Lock, ShieldCheck, Timer } from 'lucide-react';
import { SettingsSection, SettingsCard, Field, TextInput, Toggle } from '../SettingsForm';

/**
 * Security policy.
 *
 * Backs `SchoolSecuritySettings`. These values are the school-level policy the
 * auth module is expected to enforce. Several are not yet wired: password
 * policy, lockout and expiry are stored but not yet checked at sign-in, and
 * session timeout does not shorten an already-issued token. The field notes say
 * so explicitly rather than implying enforcement that does not happen.
 */
interface SecuritySettings {
  requireMfaForStaff: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  passwordExpiryDays: number | undefined;
  maxFailedLogins: number;
  lockoutMinutes: number;
  sessionTimeoutMinutes: number;
  requireActivation: boolean;
  allowPasswordReset: boolean;
  passwordResetExpiryMinutes: number;
  enforceHttps: boolean;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown) => v === true;

export function SecuritySettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="security"
      title="Security Settings"
      description="Password policy, account lockout, session lifetime and transport requirements."
    >
      {(raw, set) => {
        const v = raw as unknown as SecuritySettings;
        return (
          <>
            <SettingsCard
              title="Password Policy"
              description="Stored as school policy. The sign-in path does not yet enforce the composition rules."
              icon={Lock}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Minimum Length" hint="Enforced on reset, not yet on sign-in">
                  <TextInput
                    type="number"
                    min={8}
                    max={128}
                    value={str(v.passwordMinLength)}
                    onChange={(e) => set('passwordMinLength', Number(e.target.value))}
                    placeholder="8"
                  />
                </Field>
                <Field label="Expiry (days)" hint="Blank means passwords never expire">
                  <TextInput
                    type="number"
                    min={1}
                    value={str(v.passwordExpiryDays)}
                    onChange={(e) =>
                      set('passwordExpiryDays', e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="180"
                  />
                </Field>
              </div>
              <div className="mt-4 space-y-1">
                <Toggle
                  label="Require an uppercase letter"
                  checked={bool(v.passwordRequireUppercase)}
                  onChange={(checked) => set('passwordRequireUppercase', checked)}
                />
                <Toggle
                  label="Require a number"
                  checked={bool(v.passwordRequireNumber)}
                  onChange={(checked) => set('passwordRequireNumber', checked)}
                />
                <Toggle
                  label="Require a symbol"
                  checked={bool(v.passwordRequireSymbol)}
                  onChange={(checked) => set('passwordRequireSymbol', checked)}
                />
              </div>
            </SettingsCard>

            <SettingsCard
              title="Account Protection"
              description="Applies to failed sign-in attempts and to accounts awaiting activation."
              icon={ShieldCheck}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Max Failed Logins" hint="Before the account locks">
                  <TextInput
                    type="number"
                    min={1}
                    max={100}
                    value={str(v.maxFailedLogins)}
                    onChange={(e) => set('maxFailedLogins', Number(e.target.value))}
                    placeholder="5"
                  />
                </Field>
                <Field label="Lockout Duration (minutes)">
                  <TextInput
                    type="number"
                    min={1}
                    value={str(v.lockoutMinutes)}
                    onChange={(e) => set('lockoutMinutes', Number(e.target.value))}
                    placeholder="15"
                  />
                </Field>
              </div>
              <div className="mt-4 space-y-1">
                <Toggle
                  label="Require multi-factor authentication for staff"
                  description="No MFA enrolment or challenge flow is implemented yet."
                  checked={bool(v.requireMfaForStaff)}
                  onChange={(checked) => set('requireMfaForStaff', checked)}
                />
                <Toggle
                  label="Require account activation"
                  description="Invited users must activate before their first sign-in completes."
                  checked={bool(v.requireActivation)}
                  onChange={(checked) => set('requireActivation', checked)}
                />
                <Toggle
                  label="Allow self-service password reset"
                  description="Backs the forgot-password flow. Always returns success so accounts cannot be enumerated."
                  checked={bool(v.allowPasswordReset)}
                  onChange={(checked) => set('allowPasswordReset', checked)}
                />
                <Toggle
                  label="Enforce HTTPS"
                  description="Recommended in production."
                  checked={bool(v.enforceHttps)}
                  onChange={(checked) => set('enforceHttps', checked)}
                />
              </div>
            </SettingsCard>

            <SettingsCard
              title="Sessions and Reset Tokens"
              description="Lifetime settings for issued credentials."
              icon={Timer}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field
                  label="Session Timeout (minutes)"
                  hint="Stored as policy; the access-token TTL comes from the environment, not this record"
                >
                  <TextInput
                    type="number"
                    min={5}
                    value={str(v.sessionTimeoutMinutes)}
                    onChange={(e) => set('sessionTimeoutMinutes', Number(e.target.value))}
                    placeholder="480"
                  />
                </Field>
                <Field label="Reset Token Expiry (minutes)">
                  <TextInput
                    type="number"
                    min={5}
                    value={str(v.passwordResetExpiryMinutes)}
                    onChange={(e) => set('passwordResetExpiryMinutes', Number(e.target.value))}
                    placeholder="30"
                  />
                </Field>
              </div>
            </SettingsCard>
          </>
        );
      }}
    </SettingsSection>
  );
}
