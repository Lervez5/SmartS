'use client';

import { Sparkles } from 'lucide-react';
import { SettingsSection, SettingsCard, Field, TextInput, TextArea, Toggle } from '../SettingsForm';
import { GapState } from '../block';

/**
 * Daily Glow configuration.
 *
 * Backs `SchoolGlowSettings`. The Prisma model is explicitly documented as
 * "the Daily Glow experience does not exist in the codebase yet", and the
 * record carries its own `implemented` flag. This screen stores the intent and
 * says so rather than pretending the feature is live.
 */
interface GlowSettings {
  enabled: boolean;
  headline: string;
  message: string;
  audience: string;
  cadence: string;
  contentSources: string;
  implemented: boolean;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown) => v === true;

export function GlowSettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="glow"
      title="Daily Glow Settings"
      description="Configuration reserved for the Daily Glow experience."
    >
      {(raw, set) => {
        const v = raw as unknown as GlowSettings;
        return (
          <>
            <GapState
              concept="Daily Glow"
              detail="The Daily Glow experience is not implemented. There is no route that consumes these settings, so nothing is generated or delivered from them yet. The record is the storage a future implementation will read."
            />
            <SettingsCard
              title="Glow Configuration"
              description="Reserved configuration. Leave disabled until the feature exists."
              icon={Sparkles}
            >
              <Toggle
                label="Enable Daily Glow"
                description="Has no effect while the feature is unimplemented."
                checked={bool(v.enabled)}
                onChange={(checked) => set('enabled', checked)}
              />
              <div className="mt-4 space-y-5">
                <Field label="Headline">
                  <TextInput
                    value={str(v.headline)}
                    onChange={(e) => set('headline', e.target.value)}
                  />
                </Field>
                <Field label="Message">
                  <TextArea
                    rows={3}
                    value={str(v.message)}
                    onChange={(e) => set('message', e.target.value)}
                  />
                </Field>
                <Field label="Audience" hint="Free text; no audience model exists">
                  <TextInput
                    value={str(v.audience)}
                    onChange={(e) => set('audience', e.target.value)}
                    placeholder="all staff"
                  />
                </Field>
                <Field label="Cadence" hint="e.g. daily, weekly">
                  <TextInput
                    value={str(v.cadence)}
                    onChange={(e) => set('cadence', e.target.value)}
                    placeholder="daily"
                  />
                </Field>
                <Field label="Content Sources" hint="Free text or JSON">
                  <TextInput
                    value={str(v.contentSources)}
                    onChange={(e) => set('contentSources', e.target.value)}
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
