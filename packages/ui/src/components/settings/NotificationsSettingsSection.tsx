'use client';

import * as React from 'react';
import { Bell, Moon, Send } from 'lucide-react';
import {
  SettingsSection,
  SettingsCard,
  Field,
  TextInput,
  SettingsSelect,
  Toggle,
} from '../SettingsForm';

/**
 * Notification policy.
 *
 * Backs `SchoolNotificationSettings`. The per-event matrix is stored as a JSON
 * string keyed by event name; this screen parses it, edits it as a real object
 * and re-serializes on save. A malformed value is reported rather than silently
 * overwritten.
 */
interface NotificationsSettings {
  defaultChannel: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  senderName: string;
  senderEmail: string;
  smsSenderId: string;
  smsProvider: string;
  emailProvider: string;
  eventMatrix: string;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const CHANNELS = ['in_app', 'email', 'sms', 'push'] as const;

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const bool = (v: unknown) => v === true;

/** Event keys the notifications module recognises. */
const EVENTS = [
  'announcement',
  'assignment',
  'grade',
  'attendance',
  'invoice',
  'payment',
  'admission',
  'password_reset',
] as const;

function parseMatrix(raw: string): {
  matrix: Record<string, string[]>;
  invalid: boolean;
} {
  if (!raw) return { matrix: {}, invalid: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { matrix: {}, invalid: true };
    }
    const matrix: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(value))
        matrix[key] = value.filter((c): c is string => typeof c === 'string');
    }
    return { matrix, invalid: false };
  } catch {
    return { matrix: {}, invalid: true };
  }
}

function serializeMatrix(matrix: Record<string, string[]>): string {
  if (Object.keys(matrix).length === 0) return '';
  return JSON.stringify(matrix);
}

/** Per-event channel matrix editor. Keyed by the caller on the stored value. */
function EventMatrixTable({
  matrix,
  onToggle,
}: {
  matrix: Record<string, string[]>;
  onToggle: (event: string, channel: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th scope="col" className="py-2 pr-4 text-left font-semibold text-muted-foreground">
              Event
            </th>
            {CHANNELS.map((channel) => (
              <th
                key={channel}
                scope="col"
                className="px-2 py-2 text-center font-semibold text-muted-foreground"
              >
                {channel.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {EVENTS.map((event) => {
            const active = matrix[event] ?? [];
            return (
              <tr key={event}>
                <th scope="row" className="py-2 pr-4 text-left font-medium text-foreground">
                  {event.replace(/_/g, ' ')}
                </th>
                {CHANNELS.map((channel) => (
                  <td key={channel} className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${event} via ${channel}`}
                      checked={active.includes(channel)}
                      onChange={() => onToggle(event, channel)}
                      className="h-4 w-4 cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function NotificationsSettingsSection() {
  return (
    <SettingsSection<Record<string, unknown>>
      area="notifications"
      title="Notification Settings"
      description="Delivery channels, per-event routing and quiet hours."
    >
      {(raw, set) => {
        const v = raw as unknown as NotificationsSettings;
        const { matrix, invalid } = parseMatrix(str(v.eventMatrix));

        function toggleChannel(event: string, channel: string) {
          const next = { ...matrix };
          const current = next[event] ?? [];
          next[event] = current.includes(channel)
            ? current.filter((c) => c !== channel)
            : [...current, channel];
          set('eventMatrix', serializeMatrix(next));
        }

        return (
          <>
            <SettingsCard
              title="Channels"
              description="Master switches. Turning a channel off here disables it for every event."
              icon={Send}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Default Channel">
                  <SettingsSelect
                    value={str(v.defaultChannel)}
                    onChange={(e) => set('defaultChannel', e.target.value)}
                  >
                    {CHANNELS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </SettingsSelect>
                </Field>
              </div>
              <div className="mt-4 space-y-1">
                <Toggle
                  label="In-app notifications"
                  checked={bool(v.inAppEnabled)}
                  onChange={(checked) => set('inAppEnabled', checked)}
                />
                <Toggle
                  label="Email"
                  description="Delivery requires a configured provider."
                  checked={bool(v.emailEnabled)}
                  onChange={(checked) => set('emailEnabled', checked)}
                />
                <Toggle
                  label="SMS"
                  checked={bool(v.smsEnabled)}
                  onChange={(checked) => set('smsEnabled', checked)}
                />
                <Toggle
                  label="Push"
                  checked={bool(v.pushEnabled)}
                  onChange={(checked) => set('pushEnabled', checked)}
                />
              </div>
            </SettingsCard>

            <SettingsCard
              title="Sender Configuration"
              description="Used for outgoing email and SMS."
              icon={Send}
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Sender Name">
                  <TextInput
                    value={str(v.senderName)}
                    onChange={(e) => set('senderName', e.target.value)}
                    placeholder="Greenfield Academy"
                  />
                </Field>
                <Field label="Sender Email">
                  <TextInput
                    type="email"
                    value={str(v.senderEmail)}
                    onChange={(e) => set('senderEmail', e.target.value)}
                  />
                </Field>
                <Field label="Email Provider">
                  <TextInput
                    value={str(v.emailProvider)}
                    onChange={(e) => set('emailProvider', e.target.value)}
                    placeholder="smtp"
                  />
                </Field>
                <Field label="SMS Provider">
                  <TextInput
                    value={str(v.smsProvider)}
                    onChange={(e) => set('smsProvider', e.target.value)}
                    placeholder="sms-provider"
                  />
                </Field>
                <Field
                  label="SMS Sender ID"
                  hint="Alphanumeric sender registered with the provider"
                >
                  <TextInput
                    value={str(v.smsSenderId)}
                    onChange={(e) => set('smsSenderId', e.target.value)}
                  />
                </Field>
              </div>
            </SettingsCard>

            <SettingsCard
              title="Per-Event Routing"
              description="Which channels each event uses. Stored as a JSON object keyed by event name."
              icon={Bell}
            >
              {invalid ? (
                <div
                  role="alert"
                  className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700"
                >
                  The stored event matrix is not valid JSON. Editing below will replace it.
                </div>
              ) : null}
              <EventMatrixTable
                key={serializeMatrix(matrix)}
                matrix={matrix}
                onToggle={toggleChannel}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                An event with no channel selected falls back to the default channel.
              </p>
            </SettingsCard>

            <SettingsCard
              title="Quiet Hours"
              description="Notifications raised in this window are deferred."
              icon={Moon}
            >
              <Toggle
                label="Enable quiet hours"
                checked={bool(v.quietHoursEnabled)}
                onChange={(checked) => set('quietHoursEnabled', checked)}
              />
              <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
                <Field label="Start" hint="HH:MM">
                  <TextInput
                    type="time"
                    value={str(v.quietHoursStart)}
                    onChange={(e) => set('quietHoursStart', e.target.value)}
                  />
                </Field>
                <Field label="End" hint="HH:MM">
                  <TextInput
                    type="time"
                    value={str(v.quietHoursEnd)}
                    onChange={(e) => set('quietHoursEnd', e.target.value)}
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
