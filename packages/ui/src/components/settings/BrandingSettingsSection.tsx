'use client';

import { Image as ImageIcon, LayoutTemplate, Palette } from 'lucide-react';
import { SettingsSection, SettingsCard, Field, TextInput, TextArea, Toggle } from '../SettingsForm';

/**
 * Visual identity.
 *
 * Backs `SchoolBrandingSettings`. Every portal reads this at boot to resolve the
 * school name shown in the navbar, and `GET /api/settings/branding` is readable
 * with school scope alone (no `settings.view`) so a signed-in user of any role
 * sees the correct institution name.
 */
interface BrandingSettings {
  logoUrl: string;
  logoAltText: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  portalNameOverride: string;
  loginNameOverride: string;
  reportFooter: string;
  emailFooter: string;
  invoiceFooter: string;
  receiptFooter: string;
  applyToPortals: boolean;
  applyToReports: boolean;
  applyToEmail: boolean;
  applyToFinance: boolean;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown) => v === true;

/** Guards against a colour value that would break CSS custom properties. */
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function ColourField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const invalid = value !== '' && !HEX.test(value);
  return (
    <Field label={label} error={invalid ? 'Enter a hex colour, e.g. #16a34a' : undefined}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <TextInput
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#16a34a"
          error={invalid ? 'Invalid colour' : undefined}
        />
      </div>
    </Field>
  );
}

export function BrandingSettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="branding"
      title="Branding Settings"
      description="Logo, colours, portal naming and the footer copy printed on documents and email."
    >
      {(raw, set) => {
        const v = raw as unknown as BrandingSettings;
        return (
          <>
            <SettingsCard
              title="Logo and Icon"
              description="Used by all four portals. Upload endpoints exist for branding but are not mounted in the router yet, so paste a URL for now."
              icon={ImageIcon}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Logo URL">
                  <TextInput
                    value={str(v.logoUrl)}
                    onChange={(e) => set('logoUrl', e.target.value)}
                    placeholder="https://…/logo.svg"
                  />
                </Field>
                <Field label="Logo Alt Text" hint="Read by screen readers">
                  <TextInput
                    value={str(v.logoAltText)}
                    onChange={(e) => set('logoAltText', e.target.value)}
                    placeholder="Greenfield Academy logo"
                  />
                </Field>
                <Field label="Favicon URL">
                  <TextInput
                    value={str(v.faviconUrl)}
                    onChange={(e) => set('faviconUrl', e.target.value)}
                    placeholder="https://…/favicon.ico"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Colours"
              description="The platform's own tokens define the interface palette. These values are stored for documents, reports and email; wiring them into the CSS variables is not implemented."
              icon={Palette}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <ColourField
                  label="Primary"
                  value={str(v.primaryColor)}
                  onChange={(next) => set('primaryColor', next)}
                />
                <ColourField
                  label="Secondary"
                  value={str(v.secondaryColor)}
                  onChange={(next) => set('secondaryColor', next)}
                />
                <ColourField
                  label="Accent"
                  value={str(v.accentColor)}
                  onChange={(next) => set('accentColor', next)}
                />
              </div>
            </SettingsCard>

            <SettingsCard
              title="Portal Naming"
              description="Overrides applied on the sign-in screen. Leave blank to use the portal's own name."
              icon={LayoutTemplate}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Portal Name Override">
                  <TextInput
                    value={str(v.portalNameOverride)}
                    onChange={(e) => set('portalNameOverride', e.target.value)}
                    placeholder="Greenfield Academy"
                  />
                </Field>
                <Field label="Login Name Override">
                  <TextInput
                    value={str(v.loginNameOverride)}
                    onChange={(e) => set('loginNameOverride', e.target.value)}
                    placeholder="Sign in to Greenfield Academy"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Footer Copy"
              description="Printed at the foot of generated documents and sent with email."
              icon={LayoutTemplate}
            >
              <div className="space-y-5">
                <Field label="Report Footer">
                  <TextArea
                    rows={2}
                    value={str(v.reportFooter)}
                    onChange={(e) => set('reportFooter', e.target.value)}
                    placeholder="Greenfield Academy · Confidential"
                  />
                </Field>
                <Field label="Email Footer">
                  <TextArea
                    rows={2}
                    value={str(v.emailFooter)}
                    onChange={(e) => set('emailFooter', e.target.value)}
                    placeholder="Greenfield Academy · Do not reply to this message"
                  />
                </Field>
                <Field label="Invoice Footer">
                  <TextArea
                    rows={2}
                    value={str(v.invoiceFooter)}
                    onChange={(e) => set('invoiceFooter', e.target.value)}
                    placeholder="Thank you. Payment is due within 30 days."
                  />
                </Field>
                <Field label="Receipt Footer">
                  <TextArea
                    rows={2}
                    value={str(v.receiptFooter)}
                    onChange={(e) => set('receiptFooter', e.target.value)}
                    placeholder="Received with thanks."
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Where Branding Applies"
              description="Turn a surface off to keep the platform's own styling there."
              icon={Palette}
            >
              <Toggle
                label="Portals"
                checked={bool(v.applyToPortals)}
                onChange={(checked) => set('applyToPortals', checked)}
              />
              <Toggle
                label="Reports"
                checked={bool(v.applyToReports)}
                onChange={(checked) => set('applyToReports', checked)}
              />
              <Toggle
                label="Email"
                checked={bool(v.applyToEmail)}
                onChange={(checked) => set('applyToEmail', checked)}
              />
              <Toggle
                label="Invoices and receipts"
                checked={bool(v.applyToFinance)}
                onChange={(checked) => set('applyToFinance', checked)}
              />
            </SettingsCard>
          </>
        );
      }}
    </SettingsSection>
  );
}
