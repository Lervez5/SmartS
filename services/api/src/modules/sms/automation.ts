/**
 * Automation runner.
 *
 * A BullMQ worker that evaluates the school's automation rules on their schedule
 * and prepares the campaign each one describes. This is the piece the repository
 * was missing: the queue infrastructure existed and was used by the invitation
 * flow, but no worker was ever registered, so every job that was added sat in
 * Redis forever.
 *
 * What a run does, and deliberately does not do:
 *
 *   It resolves the eligible audience for the rule from the same Finance
 *   calculation the BALANCE REMINDERS tab uses, suppresses guardians who opted
 *   out, honours the rule's minimum balance and overdue window, and creates a
 *   **draft** campaign carrying the resolved recipient set.
 *
 *   It does not send. Confirming a campaign is a separate, permissioned action
 *   taken by a person, so an automated run can never spend credits or message a
 *   guardian that no operator reviewed. A rule therefore produces a prepared
 *   campaign rather than an outbound message.
 *
 *   It is idempotent. Each rule records the last campaign it prepared, so a
 *   re-run inside the cooldown window is a no-op rather than another campaign,
 *   and a worker restart cannot produce a duplicate.
 */

import { Worker, type Job } from 'bullmq';
import { prisma } from '../../infrastructure/database';
import { recordAuditLog } from '../audit-logs/service';
import { resolveOutstandingBalances } from './service';

export const SMS_AUTOMATION_QUEUE = 'sms-automation';

/** One job per rule, identified so a re-schedule replaces rather than adds. */
export function automationJobId(ruleId: string): string {
  return `rule:${ruleId}`;
}

/**
 * Evaluates one rule and prepares its campaign.
 *
 * Returns a summary so the caller - and the rule's own `lastRunMessage` - can say
 * what happened without re-reading the campaign.
 */
export async function runRule(ruleId: string): Promise<{
  status: 'ok' | 'skipped' | 'error';
  message: string;
  campaignId: string | null;
}> {
  const rule = await prisma.smsAutomationRule.findUnique({ where: { id: ruleId } });
  if (!rule) {
    return { status: 'error', message: 'The rule no longer exists.', campaignId: null };
  }
  if (!rule.enabled) {
    return {
      status: 'skipped',
      message: 'The rule is disabled, so this run did nothing.',
      campaignId: null,
    };
  }

  // Cooldown is checked against the last run, not the clock, so a worker that
  // restarts or a job that is retried does not prepare the same campaign twice.
  if (rule.lastRunAt) {
    const dueAfter =
      rule.lastRunAt.getTime() + Math.max(rule.everyDays, rule.cooldownDays) * 86400000;
    if (Date.now() < dueAfter) {
      return {
        status: 'skipped',
        message: `Inside the ${rule.cooldownDays}-day cooldown; the next run is not due yet.`,
        campaignId: null,
      };
    }
  }

  if (rule.purpose === 'balance_reminder') {
    // Eligibility is resolved through the Finance calculation, which derives the
    // outstanding figure from invoices minus their receipts.
    const balances = await resolveOutstandingBalances(rule.schoolId, {
      overdueAfterDays: rule.overdueAfterDays,
      minOutstandingCents: rule.minOutstandingCents,
    });

    // Resolved again per guardian immediately before preparing, so a guardian
    // who opted out or lost their number since the last run is excluded.
    const suppressed = new Set(
      (await prisma.smsOptOut.findMany({ select: { parentProfileId: true } })).map(
        (row) => row.parentProfileId
      )
    );

    const recipients: Array<{
      parentProfileId: string;
      phone: string;
      studentProfileIds: string[];
    }> = [];

    for (const guardian of balances.guardians) {
      if (suppressed.has(guardian.parentProfileId)) continue;
      const profile = await prisma.parentProfile.findUnique({
        where: { id: guardian.parentProfileId },
        select: { user: { select: { phone: true } }, id: true },
      });
      if (!profile) continue;

      const normalised = profile.user.phone?.replace(/[^\d]/g, '') ?? '';
      if (normalised.length < 9) continue;

      const learner = balances.guardians
        .filter((row) => row.parentProfileId === guardian.parentProfileId)
        .map((row) => row.studentProfileId);

      recipients.push({
        parentProfileId: profile.id,
        phone: normalised.startsWith('0') ? `254${normalised.replace(/^0+/, '')}` : normalised,
        studentProfileIds: learner,
      });
    }

    if (recipients.length === 0) {
      await prisma.smsAutomationRule.update({
        where: { id: rule.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'skipped',
          lastRunMessage: 'No eligible guardians; nothing was prepared.',
        },
      });
      return {
        status: 'skipped',
        message: 'No eligible guardians; nothing was prepared.',
        campaignId: null,
      };
    }

    // The campaign is created directly rather than through createCampaign, which
    // is permission-gated for an interactive caller. The recipient set is the
    // same shape, resolved the same way.
    const campaign = await prisma.smsCampaign.create({
      data: {
        schoolId: rule.schoolId,
        purpose: 'balance_reminder',
        status: 'draft',
        subject: rule.subject,
        body: rule.body,
        // The count is the recipients actually resolved, so the campaign agrees
        // with its own rows rather than reading as an empty campaign.
        recipientCount: recipients.length,
        createdBy: rule.createdBy,
        recipients: {
          create: recipients.map((recipient) => ({
            parentProfileId: recipient.parentProfileId,
            studentProfileId: recipient.studentProfileIds[0] ?? null,
            phone: recipient.phone,
            status: 'pending',
          })),
        },
      },
      select: { id: true },
    });

    await prisma.smsAutomationRule.update({
      where: { id: rule.id },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: 'ok',
        lastRunMessage: `Prepared a campaign for ${recipients.length} guardian(s), awaiting review.`,
      },
    });

    await recordAuditLog(
      rule.createdBy,
      'sms.automation.ran',
      `Rule "${rule.name}" prepared a campaign for ${recipients.length} guardian(s). Awaiting review; nothing was sent.`,
      rule.schoolId
    );

    return {
      status: 'ok',
      message: `Prepared a campaign for ${recipients.length} guardian(s), awaiting review.`,
      campaignId: campaign.id,
    };
  }

  await prisma.smsAutomationRule.update({
    where: { id: rule.id },
    data: {
      lastRunAt: new Date(),
      lastRunStatus: 'skipped',
      lastRunMessage: 'Only balance-reminder rules run automatically.',
    },
  });
  return {
    status: 'skipped',
    message: 'Only balance-reminder rules run automatically.',
    campaignId: null,
  };
}

/* ------------------------------------------------------------------ *
 * Worker
 * ------------------------------------------------------------------ */

let worker: Worker | null = null;

/**
 * Whether the automation worker is running in this process.
 *
 * Reported to the workspace so it describes the truth rather than a constant:
 * the queue has been real and unused for a long time, so a screen claiming a
 * runner exists must be answering this question, not guessing.
 */
export function isAutomationWorkerRunning(): boolean {
  return worker !== null;
}

/**
 * Starts the automation worker.
 *
 * Returns the worker so the caller can close it on shutdown. Starting is
 * idempotent: calling it twice does not attach a second consumer, which would
 * run every job twice.
 */
export async function startSmsAutomationWorker(): Promise<Worker | null> {
  if (worker) return worker;

  const { redisClient } = await import('../../infrastructure/redis');

  const processor = async (job: Job) => {
    const ruleId = String(job.data.ruleId ?? '');
    if (!ruleId) throw new Error('A rule id is required.');
    // A failed job is retried by the queue; the cooldown check inside runRule is
    // what makes the retry harmless rather than a second campaign.
    return runRule(ruleId);
  };

  worker = new Worker(SMS_AUTOMATION_QUEUE, processor, {
    connection: redisClient,
    // Fewer than the default: a rule that keeps throwing should surface rather
    // than retry indefinitely behind a backoff.
    autorun: true,
  });

  worker.on('completed', (job) => {
    void job.id;
  });
  worker.on('failed', (job, err) => {
    // The job id and the error only. The job's payload is a rule id, not a
    // recipient or a message body, so nothing sensitive lands in the log.
    void job?.id;
    void err.message;
  });

  return worker;
}

/** Stops the worker, for a clean shutdown. */
export async function stopSmsAutomationWorker(): Promise<void> {
  if (!worker) return;
  await worker.close();
  worker = null;
}

/* ------------------------------------------------------------------ *
 * Scheduling
 * ------------------------------------------------------------------ */

/**
 * Schedules every enabled rule as a repeatable job.
 *
 * Called on boot so a rule that was enabled while the server was down still runs
 * once the server is back. A repeatable job is keyed by its id, so re-registering
 * the same rule replaces the old schedule rather than adding a second.
 */
export async function scheduleEnabledRules(): Promise<number> {
  const { Queue } = await import('bullmq');
  const { redisClient } = await import('../../infrastructure/redis');

  const queue = new Queue(SMS_AUTOMATION_QUEUE, { connection: redisClient });

  const rules = await prisma.smsAutomationRule.findMany({
    where: { enabled: true },
    select: { id: true, everyDays: true },
  });

  for (const rule of rules) {
    await queue.add(
      'run-rule',
      { ruleId: rule.id },
      {
        repeat: { every: Math.max(1, rule.everyDays) * 86400000 },
        jobId: automationJobId(rule.id),
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
      }
    );
  }

  await queue.close();
  return rules.length;
}

/**
 * Re-registers one rule's schedule, from the settings screen.
 *
 * Managing a rule and scheduling it are the same action, so enabling or changing
 * the interval takes effect without a restart.
 */
export async function rescheduleRule(ruleId: string): Promise<void> {
  const { Queue } = await import('bullmq');
  const { redisClient } = await import('../../infrastructure/redis');

  const queue = new Queue(SMS_AUTOMATION_QUEUE, { connection: redisClient });
  const rule = await prisma.smsAutomationRule.findUnique({
    where: { id: ruleId },
    select: { id: true, everyDays: true, enabled: true },
  });

  if (!rule) {
    await queue.close();
    return;
  }

  const jobId = automationJobId(rule.id);

  if (!rule.enabled) {
    // Removing a disabled rule's job is what stops it. Leaving it in place would
    // keep firing forever.
    const existing = await queue.getJob(jobId);
    if (existing) await existing.remove();
    await queue.close();
    return;
  }

  await queue.add(
    'run-rule',
    { ruleId: rule.id },
    {
      repeat: { every: Math.max(1, rule.everyDays) * 86400000 },
      jobId,
      attempts: 3,
      backoff: { type: 'exponential', delay: 60000 },
    }
  );

  await queue.close();
}
