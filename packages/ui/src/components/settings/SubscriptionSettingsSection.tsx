'use client';

import { CreditCard } from 'lucide-react';
import { SettingsSection, SettingsCard, Field, TextInput, Toggle } from '../SettingsForm';
import { GapState } from '../block';

/**
 * Subscription plan.
 *
 * Backs `SchoolSubscriptionSettings`. No billing provider is wired up, so this
 * screen is read-and-record only: it stores what a provider integration would
 * read, and states plainly that nothing bills.
 */
interface SubscriptionSettings {
  planCode: string;
  planName: string;
  billingCycle: string;
  seats: number | undefined;
  renewsAt: string;
  status: string;
  providerConfigured: boolean;
  providerReference: string;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown) => v === true;

export function SubscriptionSettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="subscription"
      title="Subscription Settings"
      description="Plan and renewal details for this school's subscription."
    >
      {(raw, set) => {
        const v = raw as unknown as SubscriptionSettings;
        return (
          <>
            <GapState
              concept="Subscription billing"
              detail="No billing provider is integrated, so nothing on this screen charges the school. The plan and renewal fields are the storage a provider integration would read and write."
            />
            <SettingsCard
              title="Plan"
              description="The plan this school is recorded on."
              icon={CreditCard}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Plan Code">
                  <TextInput
                    value={str(v.planCode)}
                    onChange={(e) => set('planCode', e.target.value)}
                    placeholder="CBC_SECONDARY"
                  />
                </Field>
                <Field label="Plan Name">
                  <TextInput
                    value={str(v.planName)}
                    onChange={(e) => set('planName', e.target.value)}
                    placeholder="CBC Secondary"
                  />
                </Field>
                <Field label="Billing Cycle" hint="e.g. annual, termly">
                  <TextInput
                    value={str(v.billingCycle)}
                    onChange={(e) => set('billingCycle', e.target.value)}
                  />
                </Field>
                <Field label="Seats" hint="Licensed user count">
                  <TextInput
                    type="number"
                    min={0}
                    value={str(v.seats)}
                    onChange={(e) =>
                      set('seats', e.target.value ? Number(e.target.value) : undefined)
                    }
                  />
                </Field>
                <Field label="Renews At" hint="Date">
                  <TextInput
                    type="date"
                    value={str(v.renewsAt)}
                    onChange={(e) => set('renewsAt', e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <TextInput
                    value={str(v.status)}
                    onChange={(e) => set('status', e.target.value)}
                    placeholder="active"
                  />
                </Field>
                <Field label="Provider Reference" hint="Identifier issued by the provider">
                  <TextInput
                    value={str(v.providerReference)}
                    onChange={(e) => set('providerReference', e.target.value)}
                  />
                </Field>
              </div>
              <div className="mt-4">
                <Toggle
                  label="Provider configured"
                  description="Set by the provider integration, not by hand."
                  checked={bool(v.providerConfigured)}
                  onChange={(checked) => set('providerConfigured', checked)}
                />
              </div>
            </SettingsCard>
          </>
        );
      }}
    </SettingsSection>
  );
}
