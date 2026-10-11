'use client';

import * as React from 'react';
import { useApi } from '@schoolos/hooks';
import { useAuth } from '@schoolos/auth';
import {
  Button,
  ContextFilterBar,
  DashboardCard,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FloatingFormModal,
  LoadingState,
  SectionHeader,
  Select,
  StatusPill,
  TextInput,
  notify,
  type ContextFilter,
  type DataTableColumn,
  type StatusTone,
} from '@schoolos/ui';

/**
 * SMS CENTRE - the school's outbound messaging to guardians.
 *
 * Five tabs, each honest about what it can actually do:
 *
 *   SEND SMS         compose a message and choose an audience. The recipient set
 *                    is resolved by the server from real guardian-to-learner
 *                    links, and previewed before anything is committed.
 *   BALANCE REMINDERS guardians of learners with an outstanding balance, with
 *                    the balance computed from invoices minus receipts.
 *   AUTOMATED         configured rules, scheduled on their interval by a real
 *                    worker. A run prepares a campaign for review; it does not send.
 *   HISTORY           persisted campaigns and their recipient-level outcomes.
 *   CREDITS            credit status. No provider and no ledger exist here, so
 *                    it reports "unknown" and what is required - never a number.
 *
 * The whole workspace is gated per capability: viewing, sending, chasing
 * balances, configuring rules and inspecting credits are separate permissions,
 * so an Accountant who may chase a balance cannot broadcast to the school, and a
 * Dean who may broadcast cannot read another guardian's finances.
 */

type Tab = 'send' | 'reminders' | 'automation' | 'history' | 'credits';

type Purpose = 'bulk' | 'balance_reminder';
type Audience = 'all' | 'grade' | 'stream';

type CampaignStatus =
  | 'draft'
  | 'submitted'
  | 'accepted_by_provider'
  | 'delivered'
  | 'rejected'
  | 'failed'
  | 'blocked'
  | 'cancelled';

type RecipientStatus =
  'pending' | 'queued' | 'submitted' | 'accepted' | 'delivered' | 'failed' | 'skipped';

const TABS: Array<{ id: Tab; label: string; permission?: string }> = [
  { id: 'send', label: 'SEND SMS', permission: 'sms.send' },
  { id: 'reminders', label: 'BALANCE REMINDERS', permission: 'sms.reminders' },
  { id: 'automation', label: 'AUTOMATED', permission: 'sms.manage' },
  { id: 'history', label: 'HISTORY', permission: 'sms.view' },
  { id: 'credits', label: 'CREDITS', permission: 'sms.credits' },
];

const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  accepted_by_provider: 'Accepted by provider',
  delivered: 'Delivered',
  rejected: 'Rejected',
  failed: 'Failed',
  blocked: 'Could not send',
  cancelled: 'Cancelled',
};

const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, StatusTone> = {
  draft: 'neutral',
  submitted: 'info',
  accepted_by_provider: 'info',
  delivered: 'success',
  rejected: 'danger',
  failed: 'danger',
  blocked: 'danger',
  cancelled: 'neutral',
};

const RECIPIENT_STATUS_LABEL: Record<RecipientStatus, string> = {
  pending: 'Not sent',
  queued: 'Queued',
  submitted: 'Submitted',
  accepted: 'Accepted',
  delivered: 'Delivered',
  failed: 'Failed',
  skipped: 'Skipped',
};

interface WorkspaceResponse {
  capability: {
    channelEnabled: boolean;
    providerIntegrated: boolean;
    /** Which gateway would be used, chosen from SMS_PROVIDER. */
    providerName: string;
    canSend: boolean;
    blocker: string | null;
    configuredProvider: string | null;
    /** The sender id that would actually be used, from the gateway or settings. */
    configuredSenderId: string | null;
    credits: {
      available: boolean;
      source: string;
      balance: number | null;
      /** The gateway's own balance string, shown verbatim. */
      balanceDisplay: string | null;
      currency: string | null;
      reason: string;
    };
  };
  summary: {
    total: number;
    byStatus: Record<CampaignStatus, number>;
    optOuts: number;
  };
}

interface RecipientPreview {
  parentProfileId: string;
  guardianName: string;
  learnerCount: number;
  hasPhone: boolean;
  skipReason: string | null;
}

interface RecipientPreviewResponse {
  audience: { audience: Audience; gradeLevel?: string; streamId?: string; academicYearId?: string };
  label: string;
  summary: {
    guardiansLinked: number;
    sendable: number;
    skipped: number;
    missingPhone: number;
    optedOut: number;
    invalidPhone: number;
    noPhoneRecorded: number;
    learnersCovered: number;
  };
  recipients: RecipientPreview[];
}

function formatMoney(cents: number, currency = 'KES'): string {
  return `${currency} ${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return body?.error?.message ?? `${fallback} (HTTP ${res.status})`;
}

export default function SmsCentrePage() {
  const auth = useAuth();
  const can = auth.can as (permission: string) => boolean;

  const [tab, setTab] = React.useState<Tab>('history');

  // Tabs the caller may actually open. A tab with no permission is not rendered
  // at all rather than shown and then failing, and the API refuses it too.
  const visibleTabs = TABS.filter((entry) => !entry.permission || can(entry.permission));

  React.useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((entry) => entry.id === tab)) {
      setTab(visibleTabs[0].id);
    }
  }, [visibleTabs, tab]);

  const workspace = useApi<WorkspaceResponse>(can('sms.view') ? '/api/sms' : null);

  if (workspace.loading) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="SMS CENTRE"
          description="Bulk messaging, balance reminders and SMS credits."
        />
        <LoadingState label="Loading the SMS Centre" />
      </div>
    );
  }

  if (workspace.error) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="SMS CENTRE"
          description="Bulk messaging, balance reminders and SMS credits."
        />
        <ErrorState
          title="You do not have access to the SMS Centre"
          message="Opening this workspace requires sms.view. Your role does not hold it, and the API refuses the request independently of this screen."
        />
      </div>
    );
  }

  const capability = workspace.data?.capability;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="SMS CENTRE"
        description="Bulk messaging to guardians, automated fee-balance reminders, and SMS-credit status."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">SMS credits</span>
            {/* Never a number unless something real reports one. */}
            {capability?.credits.available ? (
              <StatusPill
                label={capability.credits.balanceDisplay ?? `${capability.credits.balance ?? 0}`}
                tone="success"
              />
            ) : (
              <StatusPill label="Credits unknown" tone="warning" />
            )}
            <StatusPill
              label={capability?.canSend ? 'Sending available' : 'Sending unavailable'}
              tone={capability?.canSend ? 'success' : 'warning'}
            />
          </div>
        }
      />

      {/* No capability banner. Sending depends on gateway credentials, which are
          an operator's configuration, and an operator configuring them does not
          need the screen to explain the configuration back to them. The status
          stays visible as a badge in the header, and a campaign that cannot be
          handed off still records why - the information is there when it is
          actually needed, at the point of the action, rather than as a block
          above every tab. */}

      <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1" role="tablist">
        {visibleTabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={
              tab === entry.id
                ? 'rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground sm:text-sm'
                : 'rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:text-sm'
            }
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'send' ? <SendTab capability={capability} /> : null}
      {tab === 'reminders' ? <RemindersTab /> : null}
      {tab === 'automation' ? <AutomationTab /> : null}
      {tab === 'history' ? <HistoryTab /> : null}
      {tab === 'credits' ? <CreditsTab capability={capability} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * SEND SMS
 * ------------------------------------------------------------------ */

function SendTab({ capability }: { capability?: WorkspaceResponse['capability'] }) {
  const { can } = useAuth();

  const [audience, setAudience] = React.useState<Audience>('all');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [streamId, setStreamId] = React.useState('');
  const [academicYearId, setAcademicYearId] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [body, setBody] = React.useState('');
  const [preview, setPreview] = React.useState<RecipientPreviewResponse | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<{
    status: CampaignStatus;
    message: string;
    providerError: string | null;
  } | null>(null);

  // Academic context, so a grade or stream filter means the same thing here as
  // everywhere else in the portal rather than being a free-text guess.
  const sessions = useApi<{ sessions: Array<{ id: string; name: string; status: string }> }>(
    '/api/academic-sessions'
  );
  const classes = useApi<{
    classes: Array<{ id: string; name: string; gradeLevel: string | null }>;
  }>('/api/classes');
  // Streams come from the academic domain, so the audience filter uses real
  // streams rather than a list typed into this screen.
  const streams = useApi<{
    streams: Array<{ id: string; name: string; code: string; classId: string }>;
  }>('/api/streams');

  const gradeOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const cls of classes.data?.classes ?? []) {
      if (cls.gradeLevel) seen.add(cls.gradeLevel);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes.data]);

  const idempotencyKey = React.useMemo(
    () => `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  async function resolvePreview() {
    if (audience === 'grade' && !gradeLevel) {
      notify.error('Pick a grade first.');
      return;
    }
    if (audience === 'stream' && !streamId) {
      notify.error('Pick a stream first.');
      return;
    }

    setResolving(true);
    try {
      const res = await fetch('/api/sms/recipients', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          ...(gradeLevel ? { gradeLevel } : {}),
          ...(streamId ? { streamId } : {}),
          ...(academicYearId ? { academicYearId } : {}),
        }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not resolve recipients'));
        return;
      }
      const resolved = (await res.json()) as RecipientPreviewResponse;
      setPreview(resolved);

      if (resolved.recipients.length === 0) {
        notify.error('No guardians matched that selection.');
      } else {
        notify.success(
          `${resolved.summary.sendable} recipient(s) can be sent to, ${resolved.summary.skipped} skipped.`
        );
      }
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setResolving(false);
    }
  }

  async function createDraft() {
    if (!body.trim()) {
      notify.error('Write the message first.');
      return;
    }
    if (!preview || preview.summary.sendable === 0) {
      notify.error('Resolve recipients first, and pick a selection that has at least one.');
      return;
    }

    setConfirming(true);
    try {
      const res = await fetch('/api/sms/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'bulk',
          subject: subject.trim() || undefined,
          body: body.trim(),
          audience: {
            audience,
            ...(gradeLevel ? { gradeLevel } : {}),
            ...(streamId ? { streamId } : {}),
            ...(academicYearId ? { academicYearId } : {}),
          },
          idempotencyKey,
        }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not create the campaign'));
        return;
      }
      const created = (await res.json()) as { campaign: { id: string; status: CampaignStatus } };
      setCreatedId(created.campaign.id);
      setShowConfirm(true);
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setConfirming(false);
    }
  }

  async function submitCampaign() {
    if (!createdId) return;

    setConfirming(true);
    try {
      const res = await fetch(`/api/sms/campaigns/${createdId}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not confirm the campaign'));
        return;
      }
      const body2 = (await res.json()) as {
        campaign: { status: CampaignStatus; providerError: string | null };
        message: string;
      };
      setLastResult({
        status: body2.campaign.status,
        message: body2.message,
        providerError: body2.campaign.providerError,
      });
      setShowConfirm(false);

      if (body2.campaign.status === 'blocked') {
        notify.error(body2.message);
      } else {
        notify.success(body2.message);
      }
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setConfirming(false);
    }
  }

  if (!can('sms.send')) {
    return (
      <ErrorState
        title="You cannot compose bulk SMS"
        message="Sending bulk SMS requires sms.send. Your role does not hold it, and the API refuses the request independently of this screen."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Compose a message</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose who this goes to, write the message, and review the resolved recipients before
          anything is committed. Recipients are resolved by the server from guardian-to-learner
          links - a count or a phone list sent from this screen is never trusted.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Audience" required>
            <Select
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as Audience);
                setPreview(null);
              }}
            >
              <option value="all">All parents</option>
              <option value="grade">By grade</option>
              <option value="stream">By stream</option>
            </Select>
          </Field>

          <Field label="Academic session" hint="Used to resolve grade and stream placements.">
            <Select
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Any session</option>
              {(sessions.data?.sessions ?? []).map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                  {session.status === 'active' ? ' (current)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          {audience === 'grade' ? (
            <Field label="Grade" required hint="Grades come from your school's classes.">
              <Select
                value={gradeLevel}
                onChange={(e) => {
                  setGradeLevel(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Select a grade…</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {audience === 'stream' ? (
            <Field label="Stream" required hint="Streams are read from the academic domain.">
              <Select
                value={streamId}
                onChange={(e) => {
                  setStreamId(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Select a stream…</option>
                {(streams.data?.streams ?? []).map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name} ({stream.code})
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          {/* SMS has no subject line. This labels the campaign internally and is
              never sent as a header - pretending otherwise would imply a
              capability no provider offers. */}
          <Field
            label="Subject (internal label)"
            hint="SMS has no subject line. This labels the campaign for your records only."
          >
            <TextInput
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Fee reminder - Term 2"
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={resolvePreview} disabled={resolving}>
            {resolving ? 'Resolving…' : 'Resolve recipients'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Message</h2>

        <div className="mt-4">
          <Field
            label="Message body"
            required
            hint={`${body.length} character(s). SMS is plain text - formatting is not carried.`}
          >
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              maxLength={1600}
              placeholder="e.g. Dear parents, school reopens on Monday 12th. Please ensure learners arrive by 7:30am."
              className="w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none"
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {body.trim()
              ? `${body.length} characters · roughly ${Math.max(1, Math.ceil(body.length / 153))} SMS segment(s) at GSM-7, or ${Math.max(1, Math.ceil(body.length / 67))} at UCS-2 if the text needs it. An estimate on the encoding standard, not a provider limit.`
              : 'Write a message to see the segment estimate.'}
          </p>
          <Button onClick={createDraft} disabled={confirming || !body.trim() || !preview}>
            {confirming ? 'Creating…' : 'Review and confirm'}
          </Button>
        </div>
      </div>

      {/* Resolved recipients. The count is the server's, and a guardian linked
          to several learners in this audience is one row, because the message is
          to the guardian once. */}
      {preview ? (
        <div className="rounded-lg border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Resolved recipients</h2>
            <StatusPill
              label={`${preview.summary.sendable} sendable · ${preview.summary.skipped} skipped`}
              tone={preview.summary.sendable > 0 ? 'success' : 'warning'}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{preview.label}</p>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DashboardCard
              title="Guardians"
              value={preview.summary.guardiansLinked}
              icon="users-round"
              description="Unique guardians in this audience"
            />
            <DashboardCard
              title="Sendable"
              value={preview.summary.sendable}
              icon="check"
              tone="success"
              description="With a usable number"
            />
            <DashboardCard
              title="No phone"
              value={preview.summary.missingPhone}
              icon="triangle-alert"
              description="No usable number recorded"
            />
            <DashboardCard
              title="Opted out"
              value={preview.summary.optedOut}
              icon="shield-check"
              description="Suppressed by request"
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">Guardian</th>
                  <th className="py-2 pr-2 font-medium">Learners</th>
                  <th className="py-2 pr-2 font-medium">Number</th>
                  <th className="py-2 pr-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.recipients.map((recipient) => (
                  <tr key={recipient.parentProfileId} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-foreground">{recipient.guardianName}</td>
                    <td className="py-2 pr-2 text-muted-foreground">
                      {recipient.learnerCount === 1
                        ? '1 learner'
                        : `${recipient.learnerCount} learners (one message)`}
                    </td>
                    <td className="py-2 pr-2 text-muted-foreground">
                      {recipient.hasPhone ? 'On record' : 'None'}
                    </td>
                    <td className="py-2 pr-2">
                      {recipient.skipReason ? (
                        <span className="text-xs text-muted-foreground">
                          {recipient.skipReason}
                        </span>
                      ) : (
                        <StatusPill label="Ready" tone="success" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Phone numbers are not shown here at any permission level. A guardian is identified by
            their record, not by the digits this screen happens to hold.
          </p>
        </div>
      ) : null}

      {lastResult ? (
        <div
          className={
            lastResult.status === 'blocked'
              ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-4'
              : 'rounded-lg border bg-card p-4'
          }
        >
          <h2 className="text-sm font-semibold text-foreground">Outcome</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lastResult.message}</p>
          {lastResult.providerError ? (
            <p className="mt-2 text-xs text-destructive">{lastResult.providerError}</p>
          ) : null}
        </div>
      ) : null}

      {/* Confirmation. The consequence is stated in terms of what will happen,
          and only this dialog's confirm sends anything. */}
      <FloatingFormModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm this campaign"
        description="Review the message and the resolved recipients. Confirming submits the campaign."
        icon="message-square"
        submitLabel={capability?.canSend ? 'Confirm and send' : 'Confirm'}
        isSubmitting={confirming}
        onSubmit={submitCampaign}
        size="lg"
      >
        {preview ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">Subject</p>
              <p className="text-sm font-medium text-foreground">
                {subject.trim() || 'No subject'}
              </p>
              <p className="mt-2 text-xs font-medium uppercase text-muted-foreground">Message</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {body.length} characters · about {Math.max(1, Math.ceil(body.length / 153))}{' '}
                segment(s) per recipient
              </p>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Recipients</dt>
                  <dd className="font-semibold text-foreground">{preview.summary.sendable}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Skipped</dt>
                  <dd className="font-semibold text-foreground">{preview.summary.skipped}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Segments each</dt>
                  <dd className="font-semibold text-foreground">
                    {Math.max(1, Math.ceil(body.length / 153))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Total segments</dt>
                  <dd className="font-semibold text-foreground">
                    {preview.summary.sendable * Math.max(1, Math.ceil(body.length / 153))}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Confirm states the consequence of the action. A provider
                acknowledgement is a receipt, not a delivery, so the wording says
                what the operator is actually committing to. */}
            <p className="text-xs text-muted-foreground">
              {capability?.canSend
                ? 'Confirming submits the campaign to the gateway. A provider acknowledgement is not a delivery; delivery is only recorded from a provider delivery report.'
                : 'Confirming records this campaign. Without gateway credentials nothing is handed off and nothing is delivered.'}
            </p>
          </div>
        ) : null}
      </FloatingFormModal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * BALANCE REMINDERS
 * ------------------------------------------------------------------ */

interface EligibleGuardian {
  parentProfileId: string;
  guardianName: string;
  learnerName: string;
  gradeLevel: string | null;
  outstandingCents: number;
  currency: string;
  oldestDueDate: string;
  invoiceCount: number;
  hasPhone: boolean;
  optedOut: boolean;
}

interface EligibleResponse {
  summary: {
    guardians: number;
    invoices: number;
    outstandingCents: number;
    skipped: { noPhone: number; optedOut: number };
  };
  guardians: EligibleGuardian[];
}

function RemindersTab() {
  const { can } = useAuth();
  const [overdueAfterDays, setOverdueAfterDays] = React.useState('0');
  const [minAmount, setMinAmount] = React.useState('');
  const [academicYearId, setAcademicYearId] = React.useState('');
  const [gradeLevel, setGradeLevel] = React.useState('');
  const [body, setBody] = React.useState(
    'Dear {guardian}, our records show an outstanding balance of {amount} for {learner}. Please arrange payment at your earliest convenience.'
  );
  const [subject, setSubject] = React.useState('Fee balance reminder');
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{
    status: CampaignStatus;
    message: string;
    providerError: string | null;
  } | null>(null);
  const [campaignId, setCampaignId] = React.useState<string | null>(null);

  const sessions = useApi<{ sessions: Array<{ id: string; name: string; status: string }> }>(
    '/api/academic-sessions'
  );
  const classes = useApi<{
    classes: Array<{ id: string; name: string; gradeLevel: string | null }>;
  }>('/api/classes');

  const gradeOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const cls of classes.data?.classes ?? []) {
      if (cls.gradeLevel) seen.add(cls.gradeLevel);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [classes.data]);

  const params = new URLSearchParams();
  if (overdueAfterDays) params.set('overdueAfterDays', overdueAfterDays);
  if (minAmount) params.set('minOutstandingCents', String(Math.round(Number(minAmount) * 100)));
  if (academicYearId) params.set('academicYearId', academicYearId);
  if (gradeLevel) params.set('gradeLevel', gradeLevel);
  const qs = params.toString();

  // Eligible guardians are resolved by the server from invoices and receipts.
  // Nothing about the amount is computed here.
  const eligible = useApi<EligibleResponse>(
    can('sms.reminders') && can('finance.view') ? `/api/sms/reminders/eligible?${qs}` : null
  );

  const sendable = (eligible.data?.guardians ?? []).filter(
    (guardian) => guardian.hasPhone && !guardian.optedOut
  );
  const totalOutstanding = sendable.reduce((sum, guardian) => sum + guardian.outstandingCents, 0);

  async function createReminderCampaign() {
    setCreating(true);
    try {
      const res = await fetch('/api/sms/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'balance_reminder',
          subject: subject.trim() || undefined,
          body: body.trim(),
          financeOptions: {
            overdueAfterDays: Number(overdueAfterDays || 0),
            minOutstandingCents: minAmount ? Math.round(Number(minAmount) * 100) : 0,
            ...(academicYearId ? { academicYearId } : {}),
          },
          idempotencyKey: `web-reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not create the reminder campaign'));
        return;
      }
      const created = (await res.json()) as { campaign: { id: string } };
      setCampaignId(created.campaign.id);
      setShowConfirm(true);
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setCreating(false);
    }
  }

  async function submitReminder() {
    if (!campaignId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/sms/campaigns/${campaignId}/confirm`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not confirm the reminder campaign'));
        return;
      }
      const result = (await res.json()) as {
        campaign: { status: CampaignStatus; providerError: string | null };
        message: string;
      };
      setLastResult({
        status: result.campaign.status,
        message: result.message,
        providerError: result.campaign.providerError,
      });
      setShowConfirm(false);
      if (result.campaign.status === 'blocked') notify.error(result.message);
      else notify.success(result.message);
      eligible.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setCreating(false);
    }
  }

  if (!can('sms.reminders') || !can('finance.view')) {
    return (
      <ErrorState
        title="You cannot send balance reminders"
        message="Sending balance reminders requires sms.reminders and finance.view. Your role does not hold them, and the API refuses the request independently of this screen."
      />
    );
  }

  const filters: ContextFilter[] = [
    {
      id: 'grade',
      label: 'Grade',
      value: gradeLevel,
      allowAll: true,
      allLabel: 'All grades',
      options: gradeOptions.map((grade) => ({ value: grade, label: grade })),
      onChange: setGradeLevel,
    },
    {
      id: 'session',
      label: 'Session',
      value: academicYearId,
      allowAll: true,
      allLabel: 'Any session',
      options: (sessions.data?.sessions ?? []).map((session) => ({
        value: session.id,
        label: session.name,
      })),
      onChange: setAcademicYearId,
    },
  ];

  const columns: Array<DataTableColumn<EligibleGuardian>> = [
    {
      id: 'guardian',
      header: 'Guardian',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.guardianName}</p>
          <p className="truncate text-xs text-muted-foreground">for {row.learnerName}</p>
        </div>
      ),
      sortValue: (row) => row.guardianName,
    },
    {
      id: 'grade',
      header: 'Grade',
      cell: (row) => <span className="text-sm text-foreground">{row.gradeLevel ?? '—'}</span>,
      hideBelow: 'sm',
      sortValue: (row) => row.gradeLevel ?? '',
    },
    {
      id: 'balance',
      header: 'Outstanding',
      align: 'right',
      cell: (row) => (
        <span className="text-sm font-medium text-foreground">
          {formatMoney(row.outstandingCents, row.currency)}
        </span>
      ),
      hideBelow: 'sm',
      sortValue: (row) => row.outstandingCents,
    },
    {
      id: 'invoices',
      header: 'Invoices',
      align: 'right',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.invoiceCount}</span>,
      hideBelow: 'md',
      sortValue: (row) => row.invoiceCount,
    },
    {
      id: 'oldest',
      header: 'Oldest due',
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.oldestDueDate)}</span>
      ),
      hideBelow: 'md',
      sortValue: (row) => row.oldestDueDate,
    },
    {
      id: 'eligibility',
      header: 'Eligible',
      cell: (row) =>
        row.optedOut ? (
          <StatusPill label="Opted out" tone="neutral" />
        ) : row.hasPhone ? (
          <StatusPill label="Ready" tone="success" />
        ) : (
          <StatusPill label="No number" tone="warning" />
        ),
      sortValue: (row) => (row.optedOut ? 2 : row.hasPhone ? 0 : 1),
    },
  ];

  return (
    <div className="space-y-6">
      <ContextFilterBar
        filters={filters}
        search={undefined}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Overdue after" className="w-40">
              <Select
                value={overdueAfterDays}
                onChange={(e) => setOverdueAfterDays(e.target.value)}
              >
                <option value="0">Any overdue</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </Select>
            </Field>
            <Field label="Minimum balance" className="w-40">
              <TextInput
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="0"
                inputMode="decimal"
              />
            </Field>
          </div>
        }
      />

      {eligible.loading ? (
        <LoadingState label="Resolving outstanding balances" />
      ) : eligible.error ? (
        <ErrorState
          title="Could not resolve outstanding balances"
          message="The reminder audience is computed from invoices and receipts by the Finance domain. Confirm the API is running and that your session holds both sms.reminders and finance.view."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DashboardCard
              title="Guardians"
              value={eligible.data?.summary.guardians ?? 0}
              icon="users-round"
              tone="accent"
              description="With an outstanding balance"
            />
            <DashboardCard
              title="Sendable"
              value={sendable.length}
              icon="check"
              tone="success"
              description="Has a number and is not suppressed"
            />
            <DashboardCard
              title="Total outstanding"
              value={formatMoney(totalOutstanding, eligible.data?.guardians[0]?.currency)}
              icon="layers"
              tone="warning"
              description="Sum over the sendable reminders"
            />
          </div>

          <div className="rounded-lg border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Reminder message</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sent once per guardian. A guardian with several learners owing money is one message
              with their own total - never another guardian's.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Subject (internal label)" hint="Labels the campaign for your records.">
                <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} />
              </Field>
              <Field label="Message body" required>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={1600}
                  placeholder="Dear {guardian}, our records show an outstanding balance…"
                  className="w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none"
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {body.length} characters · about {Math.max(1, Math.ceil(body.length / 153))}{' '}
                segment(s) per recipient
              </p>
              <Button onClick={createReminderCampaign} disabled={creating || sendable.length === 0}>
                {creating ? 'Preparing…' : `Review ${sendable.length} reminder(s)`}
              </Button>
            </div>
          </div>

          <DataTable
            caption="Guardians with an outstanding balance"
            columns={columns}
            rows={eligible.data?.guardians ?? []}
            rowKey={(row) => row.parentProfileId}
            pageSize={15}
            empty={
              <EmptyState
                title="No guardians owe a balance"
                description="Nothing is overdue under these filters. Adjust the overdue window, the minimum balance, or the grade."
                icon="check"
              />
            }
          />

          <p className="text-xs text-muted-foreground">
            Balances are computed as the invoice amount minus its receipts. An invoice with a
            partial payment shows only what is still owed, and a fully settled one is not reminded.
            A <code className="rounded bg-muted px-1">void</code> invoice is not a debt. Phone
            numbers are never shown here.
          </p>
        </>
      )}

      {lastResult ? (
        <div
          className={
            lastResult.status === 'blocked'
              ? 'rounded-lg border border-destructive/40 bg-destructive/5 p-4'
              : 'rounded-lg border bg-card p-4'
          }
        >
          <h2 className="text-sm font-semibold text-foreground">Outcome</h2>
          <p className="mt-1 text-sm text-muted-foreground">{lastResult.message}</p>
          {lastResult.providerError ? (
            <p className="mt-2 text-xs text-destructive">{lastResult.providerError}</p>
          ) : null}
        </div>
      ) : null}

      <FloatingFormModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm balance reminders"
        description="Review the audience and the message before submitting."
        icon="message-square"
        submitLabel="Confirm reminders"
        isSubmitting={creating}
        onSubmit={submitReminder}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium text-foreground">{subject || 'No subject'}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{body}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Recipients</dt>
              <dd className="font-semibold text-foreground">{sendable.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total outstanding</dt>
              <dd className="font-semibold text-foreground">
                {formatMoney(totalOutstanding, eligible.data?.guardians[0]?.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Segments each</dt>
              <dd className="font-semibold text-foreground">
                {Math.max(1, Math.ceil(body.length / 153))}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Each guardian receives one message covering their own learners only. Confirming prepares
            the reminder campaign for the resolved guardians.
          </p>
        </div>
      </FloatingFormModal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * AUTOMATED
 * ------------------------------------------------------------------ */

interface AutomationRule {
  id: string;
  name: string;
  purpose: Purpose;
  enabled: boolean;
  everyDays: number;
  overdueAfterDays: number;
  minOutstandingCents: number;
  cooldownDays: number;
  subject: string | null;
  body: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunMessage: string | null;
  createdAt: string;
}

interface AutomationResponse {
  rules: AutomationRule[];
  execution: {
    schedulerPresent: boolean;
    workerRegistered: boolean;
    /** Rules defined for this school, and how many are enabled. */
    ruleCount: number;
    enabledCount: number;
    reason: string;
  };
}

function AutomationTab() {
  const { can } = useAuth();
  const canManage = can('sms.manage');
  const rules = useApi<AutomationResponse>('/api/sms/automation');

  const [showCreate, setShowCreate] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [draft, setDraft] = React.useState({
    name: '',
    everyDays: '7',
    overdueAfterDays: '0',
    minOutstandingCents: '',
    cooldownDays: '7',
    subject: 'Fee balance reminder',
    body: 'Dear {guardian}, our records show an outstanding balance for {learner}. Please arrange payment.',
    enabled: false,
  });

  async function createRule() {
    if (!draft.name.trim()) {
      notify.error('Give the rule a name.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/sms/automation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          purpose: 'balance_reminder',
          everyDays: Number(draft.everyDays || 7),
          overdueAfterDays: Number(draft.overdueAfterDays || 0),
          minOutstandingCents: draft.minOutstandingCents
            ? Math.round(Number(draft.minOutstandingCents) * 100)
            : 0,
          cooldownDays: Number(draft.cooldownDays || 7),
          subject: draft.subject.trim() || undefined,
          body: draft.body.trim(),
          enabled: draft.enabled,
        }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not create the rule'));
        return;
      }
      notify.success(`Automation rule "${draft.name}" created.`);
      setShowCreate(false);
      setDraft({ ...draft, name: '' });
      rules.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(rule: AutomationRule) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sms/automation/${rule.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not update the rule'));
        return;
      }
      notify.success(`"${rule.name}" is now ${!rule.enabled ? 'enabled' : 'disabled'}.`);
      rules.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteRule(rule: AutomationRule) {
    setBusy(true);
    try {
      const res = await fetch(`/api/sms/automation/${rule.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        notify.error(await errorMessage(res, 'Could not delete the rule'));
        return;
      }
      notify.success(`"${rule.name}" deleted.`);
      rules.refetch();
    } catch {
      notify.error('Could not reach the API. Check that it is running.');
    } finally {
      setBusy(false);
    }
  }

  const columns: Array<DataTableColumn<AutomationRule>> = [
    {
      id: 'name',
      header: 'Rule',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.purpose === 'balance_reminder' ? 'Balance reminder' : 'Bulk message'}
          </p>
        </div>
      ),
      sortValue: (row) => row.name,
    },
    {
      id: 'schedule',
      header: 'Schedule',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          Every {row.everyDays} day(s) · overdue {row.overdueAfterDays}d · cooldown{' '}
          {row.cooldownDays}d
        </span>
      ),
      hideBelow: 'md',
      sortValue: (row) => row.everyDays,
    },
    {
      id: 'threshold',
      header: 'Minimum',
      align: 'right',
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.minOutstandingCents > 0 ? formatMoney(row.minOutstandingCents) : 'Any'}
        </span>
      ),
      hideBelow: 'lg',
    },
    {
      id: 'enabled',
      header: 'State',
      cell: (row) => (
        <StatusPill
          label={row.enabled ? 'Enabled' : 'Disabled'}
          tone={row.enabled ? 'success' : 'neutral'}
        />
      ),
      sortValue: (row) => (row.enabled ? 0 : 1),
    },
    {
      id: 'lastRun',
      header: 'Last run',
      cell: (row) =>
        row.lastRunAt ? (
          <div>
            <p className="text-xs text-muted-foreground">{formatDate(row.lastRunAt)}</p>
            {row.lastRunStatus ? <StatusPill label={row.lastRunStatus} tone="neutral" /> : null}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Never run</span>
        ),
      hideBelow: 'md',
      sortValue: (row) => row.lastRunAt ?? '',
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => toggleRule(row)} disabled={busy}>
              {row.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => deleteRule(row)} disabled={busy}>
              Delete
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* How a rule actually behaves, stated once in the terms an operator cares
          about: what runs, when, and what it produces. */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {rules.data?.execution.workerRegistered
            ? `${rules.data.execution.enabledCount} enabled rule(s) run on their interval. Each resolves the eligible guardians from the Finance domain, suppresses anyone who opted out, and prepares a draft campaign with the real recipient count for a person to review and confirm.`
            : 'Rules run on their interval once enabled. Each resolves the eligible guardians from the Finance domain and prepares a draft campaign for review.'}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {(rules.data?.rules ?? []).length} configured rule(s)
        </p>
        {canManage ? <Button onClick={() => setShowCreate(true)}>New rule</Button> : null}
      </div>

      {rules.loading ? (
        <LoadingState label="Loading automation rules" />
      ) : rules.error ? (
        <ErrorState
          title="Could not load automation rules"
          message="Confirm the API is running and that your session holds sms.view."
        />
      ) : (
        <DataTable
          caption="Automated messaging rules"
          columns={columns}
          rows={rules.data?.rules ?? []}
          rowKey={(row) => row.id}
          pageSize={15}
          empty={
            <EmptyState
              title="No automation rules yet"
              description="A rule records a schedule, a trigger and a message. Note that no runner exists yet, so a rule is configuration rather than an active send."
              icon="layers"
              action={
                canManage ? <Button onClick={() => setShowCreate(true)}>New rule</Button> : null
              }
            />
          }
        />
      )}

      <FloatingFormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="New automation rule"
        description="Records the rule. With no runner in this repository, nothing is scheduled by creating it."
        icon="layers"
        submitLabel="Create rule"
        isSubmitting={busy}
        onSubmit={createRule}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rule name" required>
            <TextInput
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Term fee reminder"
            />
          </Field>
          <Field label="Subject (internal label)">
            <TextInput
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              placeholder="Fee balance reminder"
            />
          </Field>
          <Field label="Run every (days)">
            <TextInput
              value={draft.everyDays}
              onChange={(e) => setDraft({ ...draft, everyDays: e.target.value })}
              placeholder="7"
              inputMode="numeric"
            />
          </Field>
          <Field
            label="Overdue after (days)"
            hint="A balance must be overdue by this long to be eligible."
          >
            <TextInput
              value={draft.overdueAfterDays}
              onChange={(e) => setDraft({ ...draft, overdueAfterDays: e.target.value })}
              placeholder="0"
              inputMode="numeric"
            />
          </Field>
          <Field label="Minimum balance" hint="Ignore balances below this.">
            <TextInput
              value={draft.minOutstandingCents}
              onChange={(e) => setDraft({ ...draft, minOutstandingCents: e.target.value })}
              placeholder="0"
              inputMode="decimal"
            />
          </Field>
          <Field
            label="Cooldown (days)"
            hint="Per guardian, so a re-run does not remind them again."
          >
            <TextInput
              value={draft.cooldownDays}
              onChange={(e) => setDraft({ ...draft, cooldownDays: e.target.value })}
              placeholder="7"
              inputMode="numeric"
            />
          </Field>
          <Field label="Message body" required className="sm:col-span-2">
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={4}
              maxLength={1600}
              placeholder="Dear {guardian}, our records show an outstanding balance…"
              className="w-full rounded-xl border border-input/80 bg-background/80 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-foreground sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Enable this rule
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Enabling records the decision in the audit trail and schedules the rule on its interval.
        </p>
      </FloatingFormModal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * HISTORY
 * ------------------------------------------------------------------ */

interface CampaignRecord {
  id: string;
  purpose: Purpose;
  status: CampaignStatus;
  subject: string | null;
  body: string;
  segmentsPerMessage: number;
  encoding: string;
  recipientCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  providerMessageId: string | null;
  providerError: string | null;
  submittedAt: string | null;
  createdAt: string;
  recipients: Array<{
    id: string;
    parentProfileId: string | null;
    studentProfileId: string | null;
    phoneMasked: string | null;
    status: RecipientStatus;
    skipReason: string | null;
    error: string | null;
  }>;
}

function HistoryTab() {
  const [status, setStatus] = React.useState('');
  const [purpose, setPurpose] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (purpose) params.set('purpose', purpose);
  if (debounced) params.set('search', debounced);
  const qs = params.toString();

  const history = useApi<{ campaigns: CampaignRecord[] }>(
    `/api/sms/campaigns${qs ? `?${qs}` : ''}`
  );

  const campaigns = history.data?.campaigns ?? [];

  const columns: Array<DataTableColumn<CampaignRecord>> = [
    {
      id: 'when',
      header: 'Created',
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-sm text-foreground">{formatDate(row.createdAt)}</p>
          <p className="text-xs text-muted-foreground">
            {row.purpose === 'balance_reminder' ? 'Balance reminder' : 'Bulk'}
          </p>
        </div>
      ),
      sortValue: (row) => row.createdAt,
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {row.subject ?? 'No subject'}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.body}</p>
        </div>
      ),
      sortValue: (row) => row.subject ?? '',
    },
    {
      id: 'recipients',
      header: 'Recipients',
      align: 'right',
      cell: (row) => <span className="text-sm text-foreground">{row.recipientCount}</span>,
      hideBelow: 'sm',
      sortValue: (row) => row.recipientCount,
    },
    {
      id: 'delivered',
      header: 'Delivered',
      align: 'right',
      cell: (row) => (
        <span
          className={
            row.deliveredCount > 0
              ? 'text-sm font-medium text-emerald-600 dark:text-emerald-400'
              : 'text-sm text-muted-foreground'
          }
        >
          {row.deliveredCount}
        </span>
      ),
      hideBelow: 'sm',
    },
    {
      id: 'skipped',
      header: 'Skipped',
      align: 'right',
      cell: (row) => <span className="text-sm text-muted-foreground">{row.skippedCount}</span>,
      hideBelow: 'md',
      sortValue: (row) => row.skippedCount,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex flex-col gap-1">
          <StatusPill
            label={CAMPAIGN_STATUS_LABEL[row.status]}
            tone={CAMPAIGN_STATUS_TONE[row.status]}
          />
          {row.providerError ? (
            <span className="text-xs text-muted-foreground" title={row.providerError}>
              {row.providerError.length > 60
                ? `${row.providerError.slice(0, 60)}…`
                : row.providerError}
            </span>
          ) : null}
        </div>
      ),
      sortValue: (row) => row.status,
    },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (row) => (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
        >
          {expandedId === row.id ? 'Hide' : 'Detail'}
        </Button>
      ),
    },
  ];

  const expanded = campaigns.find((campaign) => campaign.id === expandedId);

  const filters: ContextFilter[] = [
    {
      id: 'purpose',
      label: 'Type',
      value: purpose,
      allowAll: true,
      allLabel: 'All campaigns',
      options: [
        { value: 'bulk', label: 'Bulk' },
        { value: 'balance_reminder', label: 'Balance reminder' },
      ],
      onChange: setPurpose,
    },
    {
      id: 'status',
      label: 'Status',
      value: status,
      allowAll: true,
      allLabel: 'Any status',
      options: (Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[]).map((key) => ({
        value: key,
        label: CAMPAIGN_STATUS_LABEL[key],
      })),
      onChange: setStatus,
    },
  ];

  return (
    <div className="space-y-4">
      <ContextFilterBar
        filters={filters}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search by subject or message…',
        }}
      />

      {history.loading ? (
        <LoadingState label="Loading campaign history" />
      ) : history.error ? (
        <ErrorState
          title="Could not load campaign history"
          message="Confirm the API is running and that your session holds sms.view."
        />
      ) : (
        <DataTable
          caption="SMS campaign history"
          columns={columns}
          rows={campaigns}
          rowKey={(row) => row.id}
          pageSize={15}
          empty={
            <EmptyState
              title={
                debounced || status || purpose
                  ? 'No campaigns match these filters'
                  : 'No campaigns yet'
              }
              description={
                debounced || status || purpose
                  ? 'Adjust the filters above.'
                  : 'Campaigns composed in this workspace are recorded here, with their recipient outcomes.'
              }
              icon="message-square"
            />
          }
        />
      )}

      {expanded ? (
        <div className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">
            {expanded.subject ?? 'No subject'} · {expanded.recipientCount} recipient(s)
          </h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{expanded.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {expanded.encoding}, {expanded.segmentsPerMessage} segment(s) per recipient · created{' '}
            {formatDate(expanded.createdAt)}
            {expanded.submittedAt ? ` · submitted ${formatDate(expanded.submittedAt)}` : ''}
          </p>

          {expanded.providerError ? (
            <p className="mt-3 rounded-md bg-destructive/5 p-3 text-xs text-destructive">
              {expanded.providerError}
            </p>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">Guardian</th>
                  <th className="py-2 pr-2 font-medium">Number</th>
                  <th className="py-2 pr-2 font-medium">Outcome</th>
                  <th className="py-2 pr-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {expanded.recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-foreground">
                      {recipient.parentProfileId ? 'Guardian' : '—'}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs text-muted-foreground">
                      {recipient.phoneMasked ?? '—'}
                    </td>
                    <td className="py-2 pr-2">
                      <StatusPill
                        label={RECIPIENT_STATUS_LABEL[recipient.status]}
                        tone={
                          recipient.status === 'delivered'
                            ? 'success'
                            : recipient.status === 'failed' || recipient.status === 'skipped'
                              ? recipient.status === 'failed'
                                ? 'danger'
                                : 'neutral'
                              : 'warning'
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 text-xs text-muted-foreground">
                      {recipient.skipReason ?? recipient.error ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            No outcome here is a delivery unless a provider delivery report said so. There is no
            provider integration in this repository, so no campaign can reach that state.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * CREDITS
 * ------------------------------------------------------------------ */

function CreditsTab({ capability }: { capability?: WorkspaceResponse['capability'] }) {
  const { can } = useAuth();
  const credits = useApi<{
    credits: {
      available: boolean;
      source: string;
      balance: number | null;
      /** The gateway's own balance string, shown verbatim rather than reparsed. */
      balanceDisplay: string | null;
      currency: string | null;
      reason: string;
    };
    provider: {
      integrated: boolean;
      configuredProvider: string | null;
      configuredSenderId: string | null;
      channelEnabled: boolean;
    };
    requirement: string;
  }>(can('sms.credits') ? '/api/sms/credits' : null);

  // Which gateway this deployment would use, named on the workspace rather than
  // inferred from the school's free-text settings field.
  const gatewayName = capability?.providerName;

  if (credits.error) {
    return (
      <ErrorState
        title="You cannot view credit information"
        message="Inspecting SMS credits requires sms.credits. Your role does not hold it, and the API refuses the request independently of this screen."
      />
    );
  }

  const status = credits.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <DashboardCard
          title="SMS credits"
          value={
            status?.credits.available
              ? (status.credits.balanceDisplay ?? String(status.credits.balance))
              : 'Unknown'
          }
          icon="layers"
          tone={status?.credits.available ? 'success' : 'accent'}
          description={
            status?.credits.available
              ? `Reported by the gateway as ${status.credits.currency ?? 'KES'}`
              : 'Reported by the gateway once credentials are set'
          }
        />
        <DashboardCard
          title="Gateway"
          value={status?.provider.integrated ? 'Integrated' : 'Pending credentials'}
          icon="shield-check"
          tone={status?.provider.integrated ? 'success' : 'accent'}
          description={`${gatewayName ?? 'Africa\u2019s Talking'} \u00b7 set by SMS_PROVIDER`}
        />
        <DashboardCard
          title="Channel"
          value={status?.provider.channelEnabled ? 'Enabled' : 'Disabled'}
          icon="settings"
          tone={status?.provider.channelEnabled ? 'success' : 'warning'}
          description="SMS on this school's notification settings"
        />
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Where credits come from</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {status?.credits.available
            ? `Reported by the gateway as ${status.credits.currency ?? 'KES'}. This is the gateway account's own balance, not a school wallet.`
            : 'Credits come from the gateway once its credentials are set. Nothing is shown until then, because a placeholder balance would be indistinguishable from a real one.'}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Configuration</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Provider (settings)</dt>
            <dd className="text-foreground">{status?.provider.configuredProvider ?? 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sender ID (settings)</dt>
            <dd className="text-foreground">{status?.provider.configuredSenderId ?? 'Not set'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          These are free-text values from the school's notification settings. Nothing in this
          codebase reads them to select a gateway, so setting them alone does not enable sending.
          Configure them under Settings → Notifications, and note that saving that area requires
          settings.manage, which only a Super Admin holds.
        </p>
      </div>
    </div>
  );
}
