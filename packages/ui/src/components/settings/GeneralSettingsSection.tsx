'use client';

import { Building2, PhoneCall, MapPin, ScrollText, UserCog } from 'lucide-react';
import { SettingsSection, SettingsCard, Field, TextInput, TextArea } from '../SettingsForm';

interface GeneralSettings {
  name: string;
  displayName: string;
  registrationNumber: string;
  schoolCode: string;
  schoolType: string;
  schoolLevel: string;
  curriculum: string;
  yearEstablished: number | undefined;
  motto: string;
  vision: string;
  mission: string;
  description: string;
  phone: string;
  email: string;
  altPhone: string;
  altEmail: string;
  website: string;
  admissionsEmail: string;
  admissionsPhone: string;
  financeEmail: string;
  financePhone: string;
  country: string;
  county: string;
  subCounty: string;
  town: string;
  postalAddress: string;
  postalCode: string;
  physicalAddress: string;
  latitude: number | undefined;
  longitude: number | undefined;
  principalName: string;
  principalEmail: string;
  principalPhone: string;
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/**
 * School profile: identity, contact, location and institutional copy.
 *
 * Values come from the school's general settings record. Optional fields stay
 * optional; nothing here is required beyond the school's name.
 */
export function GeneralSettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="general"
      permission="settings.manage"
      title="General Settings"
      description="Control the school's profile, contact information, identity and location."
    >
      {(raw, set) => {
        const v = raw as unknown as GeneralSettings;
        return (
          <>
            <SettingsCard
              title="School Identity"
              description="The core institutional details used across portals, reports and communications."
              icon={Building2}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="School Name" required hint="Official registered name">
                  <TextInput
                    value={str(v.name)}
                    onChange={(e) => set('name', e.target.value)}
                    placeholder="Greenfield Academy"
                  />
                </Field>
                <Field label="Display Name" hint="Shown in portals and on documents">
                  <TextInput
                    value={str(v.displayName)}
                    onChange={(e) => set('displayName', e.target.value)}
                    placeholder="Greenfield Academy"
                  />
                </Field>
                <Field label="Registration Number" hint="Institutional identification">
                  <TextInput
                    value={str(v.registrationNumber)}
                    onChange={(e) => set('registrationNumber', e.target.value)}
                    placeholder="REG/2021/0456"
                  />
                </Field>
                <Field label="School Code" hint="Used on invoices and admissions">
                  <TextInput
                    value={str(v.schoolCode)}
                    onChange={(e) => set('schoolCode', e.target.value.toUpperCase())}
                    placeholder="GFA"
                  />
                </Field>
                <Field label="School Type">
                  <TextInput
                    value={str(v.schoolType)}
                    onChange={(e) => set('schoolType', e.target.value)}
                    placeholder="Day Secondary"
                  />
                </Field>
                <Field label="School Level">
                  <TextInput
                    value={str(v.schoolLevel)}
                    onChange={(e) => set('schoolLevel', e.target.value)}
                    placeholder="Secondary"
                  />
                </Field>
                <Field label="Curriculum" hint="Education system in use">
                  <TextInput
                    value={str(v.curriculum)}
                    onChange={(e) => set('curriculum', e.target.value)}
                    placeholder="CBC"
                  />
                </Field>
                <Field label="Year Established">
                  <TextInput
                    type="number"
                    value={str(v.yearEstablished)}
                    onChange={(e) =>
                      set('yearEstablished', e.target.value ? Number(e.target.value) : undefined)
                    }
                    placeholder="2010"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Leadership"
              description="The school's principal or headteacher, used on reports and official correspondence."
              icon={UserCog}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <Field label="Principal / Headteacher">
                  <TextInput
                    value={str(v.principalName)}
                    onChange={(e) => set('principalName', e.target.value)}
                    placeholder="Grace Wanjiku"
                  />
                </Field>
                <Field label="Principal Email">
                  <TextInput
                    type="email"
                    value={str(v.principalEmail)}
                    onChange={(e) => set('principalEmail', e.target.value)}
                    placeholder="principal@school.edu"
                  />
                </Field>
                <Field label="Principal Phone">
                  <TextInput
                    value={str(v.principalPhone)}
                    onChange={(e) => set('principalPhone', e.target.value)}
                    placeholder="+254700000001"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Contact Information"
              description="The school's official communication details. Individual users do not inherit permission to change these."
              icon={PhoneCall}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Official Phone">
                  <TextInput
                    value={str(v.phone)}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="+254700000000"
                  />
                </Field>
                <Field label="Official Email">
                  <TextInput
                    type="email"
                    value={str(v.email)}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="info@school.example"
                  />
                </Field>
                <Field label="Alternative Phone">
                  <TextInput
                    value={str(v.altPhone)}
                    onChange={(e) => set('altPhone', e.target.value)}
                    placeholder="+254700000009"
                  />
                </Field>
                <Field label="Alternative Email">
                  <TextInput
                    type="email"
                    value={str(v.altEmail)}
                    onChange={(e) => set('altEmail', e.target.value)}
                    placeholder="contact@school.edu"
                  />
                </Field>
                <Field label="Admissions Email">
                  <TextInput
                    type="email"
                    value={str(v.admissionsEmail)}
                    onChange={(e) => set('admissionsEmail', e.target.value)}
                    placeholder="admissions@school.edu"
                  />
                </Field>
                <Field label="Admissions Phone">
                  <TextInput
                    value={str(v.admissionsPhone)}
                    onChange={(e) => set('admissionsPhone', e.target.value)}
                    placeholder="+254700000002"
                  />
                </Field>
                <Field label="Finance / Billing Email">
                  <TextInput
                    type="email"
                    value={str(v.financeEmail)}
                    onChange={(e) => set('financeEmail', e.target.value)}
                    placeholder="finance@school.edu"
                  />
                </Field>
                <Field label="Finance / Billing Phone">
                  <TextInput
                    value={str(v.financePhone)}
                    onChange={(e) => set('financePhone', e.target.value)}
                    placeholder="+254700000003"
                  />
                </Field>
                <Field label="Website">
                  <TextInput
                    value={str(v.website)}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder="https://school.example"
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Location and Address"
              description="Where the institution is located. Structured for Kenya while staying open to other jurisdictions."
              icon={MapPin}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <Field label="Country">
                  <TextInput
                    value={str(v.country)}
                    onChange={(e) => set('country', e.target.value)}
                    placeholder="Kenya"
                  />
                </Field>
                <Field label="County / State">
                  <TextInput
                    value={str(v.county)}
                    onChange={(e) => set('county', e.target.value)}
                    placeholder="Nairobi"
                  />
                </Field>
                <Field label="Sub-County">
                  <TextInput
                    value={str(v.subCounty)}
                    onChange={(e) => set('subCounty', e.target.value)}
                    placeholder="Nairobi"
                  />
                </Field>
                <Field label="Town / City">
                  <TextInput
                    value={str(v.town)}
                    onChange={(e) => set('town', e.target.value)}
                    placeholder="Nairobi"
                  />
                </Field>
                <Field label="Postal Code">
                  <TextInput
                    value={str(v.postalCode)}
                    onChange={(e) => set('postalCode', e.target.value)}
                    placeholder="00100"
                  />
                </Field>
                <Field label="Postal Address">
                  <TextInput
                    value={str(v.postalAddress)}
                    onChange={(e) => set('postalAddress', e.target.value)}
                    placeholder="postal address"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Physical Address">
                    <TextInput
                      value={str(v.physicalAddress)}
                      onChange={(e) => set('physicalAddress', e.target.value)}
                      placeholder="physical address"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-5 md:col-span-3 md:grid-cols-2">
                  <Field label="Latitude" hint="Optional">
                    <TextInput
                      type="number"
                      step="any"
                      value={str(v.latitude)}
                      onChange={(e) =>
                        set('latitude', e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="-1.2921"
                    />
                  </Field>
                  <Field label="Longitude" hint="Optional">
                    <TextInput
                      type="number"
                      step="any"
                      value={str(v.longitude)}
                      onChange={(e) =>
                        set('longitude', e.target.value ? Number(e.target.value) : undefined)
                      }
                      placeholder="36.8219"
                    />
                  </Field>
                </div>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Institutional Information"
              description="Public-facing copy used on the website, reports and letters."
              icon={ScrollText}
            >
              <div className="space-y-5">
                <Field label="Motto">
                  <TextInput
                    value={str(v.motto)}
                    onChange={(e) => set('motto', e.target.value)}
                    placeholder="Knowledge and Character"
                  />
                </Field>
                <Field label="Vision">
                  <TextArea
                    rows={3}
                    value={str(v.vision)}
                    onChange={(e) => set('vision', e.target.value)}
                    placeholder="The future the school aspires to create."
                  />
                </Field>
                <Field label="Mission">
                  <TextArea
                    rows={3}
                    value={str(v.mission)}
                    onChange={(e) => set('mission', e.target.value)}
                    placeholder="What the school does today, and for whom."
                  />
                </Field>
                <Field label="Description">
                  <TextArea
                    rows={4}
                    value={str(v.description)}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="A short introduction, used on reports and the website."
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
