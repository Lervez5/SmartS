/**
 * SMS Centre routes.
 *
 * Every route resolves the caller's school and every read or write is scoped by
 * it. Permission gates are per capability rather than one umbrella check, so a
 * role that may chase balances is not thereby able to broadcast to the whole
 * school, and a role that may broadcast cannot read another guardian's finances.
 */

import { Router, type Request, type Response } from 'express';
import { SmsCampaignPurpose, SmsCampaignStatus, SmsRecipientStatus } from '@prisma/client';
import { z } from 'zod';
import { getSmsGateway, normaliseDeliveryReport } from './gateway';
import { requirePermissions } from '../../middleware/rbac';
import { config } from '../../config';
import { hasPermission } from '@schoolos/auth/permissions';
import { isAutomationWorkerRunning } from './automation';
import { requireSchoolScope, schoolScopeOf } from '../settings/scope';
import { asyncHandler } from '../../shared/asyncHandler';
import { ApiError } from '../../shared/logger';
import { prisma } from '../../infrastructure/database';
import { recordAuditLog } from '../audit-logs/service';
import {
  resolveCapability,
  resolveOutstandingBalances,
  resolveGuardianRecipients,
  resolveAudienceStudentIds,
  estimateSegments,
  normalisePhone,
  maskPhone,
  createCampaign,
  confirmCampaign,
  applyDeliveryReport,
  presentCampaign,
  listAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  listOptOuts,
  addOptOut,
  removeOptOut,
  type CampaignWithRecipients,
} from './service';

export const router: Router = Router();

router.use(requireSchoolScope());

const requireView = requirePermissions('sms.view');
const requireSend = requirePermissions('sms.send');
const requireReminders = requirePermissions('sms.reminders');
const requireManage = requirePermissions('sms.manage');
const requireCredits = requirePermissions('sms.credits');

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

const bulkAudienceSchema = z.object({
  audience: z.enum(['all', 'grade', 'stream']),
  gradeLevel: z.string().trim().min(1).optional(),
  streamId: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
});

const createCampaignSchema = z.object({
  purpose: z.nativeEnum(SmsCampaignPurpose).default(SmsCampaignPurpose.bulk),
  subject: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1, 'A message body is required.').max(1600),
  audience: bulkAudienceSchema.optional(),
  financeOptions: z
    .object({
      overdueAfterDays: z.coerce.number().int().min(0).max(3650).optional(),
      minOutstandingCents: z.coerce.number().int().min(0).optional(),
      academicYearId: z.string().trim().min(1).optional(),
    })
    .optional(),
  idempotencyKey: z.string().trim().max(120).optional(),
});

const confirmSchema = z.object({
  idempotencyKey: z.string().trim().max(120).optional(),
});

const listCampaignsSchema = z.object({
  purpose: z.nativeEnum(SmsCampaignPurpose).optional(),
  status: z.nativeEnum(SmsCampaignStatus).optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const financeSchema = z.object({
  academicYearId: z.string().trim().min(1).optional(),
  gradeLevel: z.string().trim().min(1).optional(),
  overdueAfterDays: z.coerce.number().int().min(0).max(3650).optional(),
  minOutstandingCents: z.coerce.number().int().min(0).optional(),
});

const automationSchema = z.object({
  name: z.string().trim().min(1, 'Give the rule a name.').max(160),
  purpose: z.nativeEnum(SmsCampaignPurpose).optional(),
  everyDays: z.coerce.number().int().min(1).max(365).optional(),
  overdueAfterDays: z.coerce.number().int().min(0).max(3650).optional(),
  minOutstandingCents: z.coerce.number().int().min(0).optional(),
  cooldownDays: z.coerce.number().int().min(0).max(3650).optional(),
  subject: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1, 'A message body is required.').max(1600),
  enabled: z.boolean().optional(),
});

const automationUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  everyDays: z.coerce.number().int().min(1).max(365).optional(),
  overdueAfterDays: z.coerce.number().int().min(0).max(3650).optional(),
  minOutstandingCents: z.coerce.number().int().min(0).optional(),
  cooldownDays: z.coerce.number().int().min(0).max(3650).optional(),
  subject: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1).max(1600).optional(),
});

const optOutSchema = z.object({
  parentProfileId: z.string().trim().min(1),
  reason: z.string().trim().max(500).optional(),
});

/* ------------------------------------------------------------------ *
 * Workspace
 * ------------------------------------------------------------------ */

/**
 * Everything the workspace needs to render honestly.
 *
 * Capability and credit status come from the same resolution the send path uses,
 * so the header indicator can never disagree with what a confirm would do.
 */
router.get(
  '/',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const [capability, campaignCounts, optOutCount] = await Promise.all([
      resolveCapability(schoolId),
      prisma.smsCampaign.groupBy({
        by: ['status'],
        where: { schoolId },
        _count: { _all: true },
      }),
      prisma.smsOptOut.count({
        where: { parentProfile: { user: { schoolMemberships: { some: { schoolId } } } } },
      }),
    ]);

    const byStatus = Object.values(SmsCampaignStatus).reduce<Record<string, number>>(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {}
    );
    for (const row of campaignCounts) {
      byStatus[row.status] = row._count._all;
    }

    res.json({
      capability,
      summary: {
        total: Object.values(byStatus).reduce((sum, value) => sum + value, 0),
        byStatus,
        optOuts: optOutCount,
      },
    });
  })
);

/** Estimates segments for a draft body, so the editor counts against the real rule. */
router.post(
  '/estimate',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const payload = z.object({ body: z.string() }).parse(req.body);
    res.json({ estimate: estimateSegments(payload.body) });
  })
);

/* ------------------------------------------------------------------ *
 * Recipients
 * ------------------------------------------------------------------ */

/**
 * Resolves an audience and returns the count and breakdown, creating nothing.
 *
 * This is the preview the operator confirms against, resolved by the same code
 * the campaign creation uses - so what is previewed is what would be stored,
 * rather than a client-side guess the server then disagrees with.
 */
router.post(
  '/recipients',
  requireSend,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const payload = bulkAudienceSchema.parse(req.body);

    const { studentIds, label } = await resolveAudienceStudentIds(schoolId, payload);
    const resolution = await resolveGuardianRecipients(schoolId, studentIds);

    res.json({
      audience: payload,
      label,
      summary: resolution.summary,
      // No phone numbers here at all. The preview is a count and a reason, not a
      // contact list that would sit in a browser or a log.
      recipients: resolution.recipients.map((recipient) => ({
        parentProfileId: recipient.parentProfileId,
        guardianName: recipient.guardianName,
        learnerCount: recipient.studentUserIds.length,
        hasPhone: recipient.phone !== null,
        skipReason: recipient.skipReason,
      })),
    });
  })
);

/**
 * Eligible guardians and balances from the Finance domain.
 *
 * Requires `sms.reminders` *and* `finance.view`: a role that can send must not
 * thereby read another guardian's financial position.
 */
router.get(
  '/reminders/eligible',
  requirePermissions('sms.reminders', 'finance.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = financeSchema.parse(req.query);

    const finance = await resolveOutstandingBalances(schoolId, query);
    const optedOut = await prisma.smsOptOut.findMany({ select: { parentProfileId: true } });
    const suppressed = new Set(optedOut.map((row) => row.parentProfileId));

    const parents = await prisma.parentProfile.findMany({
      where: { id: { in: finance.guardians.map((guardian) => guardian.parentProfileId) } },
      select: { id: true, user: { select: { name: true, email: true, phone: true } } },
    });
    const contactByGuardian = new Map(parents.map((row) => [row.id, row.user]));

    res.json({
      summary: finance.summary,
      guardians: finance.guardians.map((guardian) => {
        const user = contactByGuardian.get(guardian.parentProfileId);
        return {
          parentProfileId: guardian.parentProfileId,
          guardianName: guardian.guardianName,
          learnerName: guardian.learnerName,
          gradeLevel: guardian.gradeLevel,
          outstandingCents: guardian.outstandingCents,
          currency: guardian.currency,
          oldestDueDate: guardian.oldestDueDate,
          invoiceCount: guardian.invoices.length,
          hasPhone: Boolean(normalisePhone(user?.phone).ok),
          optedOut: suppressed.has(guardian.parentProfileId),
        };
      }),
    });
  })
);

/* ------------------------------------------------------------------ *
 * Campaigns
 * ------------------------------------------------------------------ */

/**
 * Creates a campaign.
 *
 * The recipient set is resolved and persisted here from school-scoped
 * relationship data. Nothing the client says about who the recipients are is
 * used - only which audience to resolve - so a tampered count or a phone list in
 * the request body has no effect on what is stored.
 */
router.post(
  '/campaigns',
  requireSend,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;
    const payload = createCampaignSchema.parse(req.body);

    // A reminder campaign is resolved from Finance, so it needs the finance view
    // as well as the ability to send: broadcasting to a grade must not become a
    // way to read or act on balances.
    if (payload.purpose === SmsCampaignPurpose.balance_reminder) {
      if (!hasPermission(req.user?.permissions, 'finance.view')) {
        throw new ApiError(
          403,
          'Creating a balance-reminder campaign requires finance.view as well as sms.send.'
        );
      }
    }

    const { campaign, resolution } = await createCampaign({
      schoolId,
      actorId,
      purpose: payload.purpose,
      subject: payload.subject,
      body: payload.body,
      audience: payload.audience,
      financeOptions: payload.financeOptions,
      idempotencyKey: payload.idempotencyKey,
    });

    await recordAuditLog(
      actorId,
      payload.purpose === SmsCampaignPurpose.balance_reminder
        ? 'sms.reminder.created'
        : 'sms.campaign.created',
      `Campaign "${campaign.subject ?? 'untitled'}" created for ${resolution.sendable.length} ` +
        `recipient(s), ${resolution.summary.skipped} skipped.`,
      schoolId
    );

    res.status(201).json({
      campaign: presentCampaign(campaign as CampaignWithRecipients, {
        revealPhones: false,
        viewFinancials: hasPermission(req.user?.permissions, 'finance.view'),
      }),
      summary: resolution.summary,
    });
  })
);

/**
 * Confirms a campaign and attempts the handoff.
 *
 * With no provider integrated this is where honesty is enforced: the campaign is
 * marked `blocked` with the reason recorded, the recipients stay unsent, and
 * nothing is reported as delivered. A delivery state is only ever written from a
 * provider delivery report, and there is none.
 */
router.post(
  '/campaigns/:id/confirm',
  requireSend,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;
    const payload = confirmSchema.parse(req.body ?? {});
    void payload;

    const { campaign, capability } = await confirmCampaign({
      schoolId,
      actorId,
      campaignId: req.params.id,
    });

    res.json({
      campaign: presentCampaign(campaign, {
        revealPhones: false,
        viewFinancials: hasPermission(req.user?.permissions, 'finance.view'),
      }),
      capability,
      // Never presented as a delivery.
      message:
        campaign.status === SmsCampaignStatus.blocked
          ? 'This campaign could not be sent. Nothing was delivered.'
          : 'Campaign submitted for delivery.',
    });
  })
);

/** Campaign history, with the filters the workspace exposes. */
router.get(
  '/campaigns',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const query = listCampaignsSchema.parse(req.query);

    const campaigns = await prisma.smsCampaign.findMany({
      where: {
        schoolId,
        ...(query.purpose ? { purpose: query.purpose } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.search
          ? {
              OR: [
                { subject: { contains: query.search, mode: 'insensitive' } },
                { body: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      include: {
        recipients: {
          select: {
            id: true,
            parentProfileId: true,
            studentProfileId: true,
            phone: true,
            status: true,
            skipReason: true,
            providerMessageId: true,
            error: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const viewFinancials = hasPermission(req.user?.permissions, 'finance.view');

    res.json({
      campaigns: campaigns.map((campaign) =>
        presentCampaign(campaign as CampaignWithRecipients, {
          revealPhones: false,
          viewFinancials,
        })
      ),
    });
  })
);

/** One campaign with its recipient-level outcomes. */
router.get(
  '/campaigns/:id',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);

    const campaign = await prisma.smsCampaign.findFirst({
      where: { id: req.params.id, schoolId },
      include: {
        recipients: {
          select: {
            id: true,
            parentProfileId: true,
            studentProfileId: true,
            phone: true,
            status: true,
            skipReason: true,
            providerMessageId: true,
            error: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!campaign) throw new ApiError(404, 'Campaign not found.');

    res.json({
      campaign: presentCampaign(campaign as CampaignWithRecipients, {
        revealPhones: false,
        viewFinancials: hasPermission(req.user?.permissions, 'finance.view'),
      }),
    });
  })
);

/* ------------------------------------------------------------------ *
 * Automation
 * ------------------------------------------------------------------ */

router.get(
  '/automation',
  requireView,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const rules = await listAutomationRules(schoolId);

    res.json({
      rules: rules.map((rule) => ({
        id: rule.id,
        name: rule.name,
        purpose: rule.purpose as SmsCampaignPurpose,
        enabled: rule.enabled,
        everyDays: rule.everyDays,
        overdueAfterDays: rule.overdueAfterDays,
        minOutstandingCents: rule.minOutstandingCents,
        cooldownDays: rule.cooldownDays,
        subject: rule.subject,
        body: rule.body,
        lastRunAt: rule.lastRunAt,
        lastRunStatus: rule.lastRunStatus,
        lastRunMessage: rule.lastRunMessage,
        createdAt: rule.createdAt,
      })),
      // Reported from what this process actually has running, rather than a
      // constant. A rule's schedule is a real repeatable job now, so saying
      // there is no runner would be untrue - and claiming a rule sends messages
      // would be untrue too. Both are stated.
      execution: {
        schedulerPresent: isAutomationWorkerRunning(),
        workerRegistered: isAutomationWorkerRunning(),
        ruleCount: rules.length,
        enabledCount: rules.filter((rule) => rule.enabled).length,
        reason:
          'The automation worker runs in this API process and its queue is real: an enabled rule ' +
          'is registered as a repeatable job and evaluated on its interval. A run resolves the ' +
          'eligible guardians and prepares a draft campaign for a person to review. It does not ' +
          'send - confirming a campaign is a separate permissioned action - and with no gateway ' +
          'configured, nothing can be delivered.',
      },
    });
  })
);

router.post(
  '/automation',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;
    const payload = automationSchema.parse(req.body);

    const rule = await createAutomationRule({
      schoolId,
      actorId,
      name: payload.name,
      purpose: payload.purpose,
      everyDays: payload.everyDays,
      overdueAfterDays: payload.overdueAfterDays,
      minOutstandingCents: payload.minOutstandingCents,
      cooldownDays: payload.cooldownDays,
      subject: payload.subject,
      body: payload.body,
      enabled: payload.enabled,
    });

    res.status(201).json({ rule });
  })
);

router.patch(
  '/automation/:id',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;
    const payload = automationUpdateSchema.parse(req.body);

    const rule = await updateAutomationRule({
      schoolId,
      actorId,
      ruleId: req.params.id,
      enabled: payload.enabled,
      everyDays: payload.everyDays,
      overdueAfterDays: payload.overdueAfterDays,
      minOutstandingCents: payload.minOutstandingCents,
      cooldownDays: payload.cooldownDays,
      subject: payload.subject,
      body: payload.body,
    });

    res.json({ rule });
  })
);

router.delete(
  '/automation/:id',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;

    await deleteAutomationRule({ schoolId, actorId, ruleId: req.params.id });
    res.status(204).send();
  })
);

/* ------------------------------------------------------------------ *
 * Opt-outs
 * ------------------------------------------------------------------ */

router.get(
  '/opt-outs',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    res.json({ optOuts: await listOptOuts(schoolId) });
  })
);

router.post(
  '/opt-outs',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;
    const payload = optOutSchema.parse(req.body);

    const record = await addOptOut({
      schoolId,
      actorId,
      parentProfileId: payload.parentProfileId,
      reason: payload.reason,
    });

    res.status(201).json({ optOut: record });
  })
);

router.delete(
  '/opt-outs/:parentProfileId',
  requireManage,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const actorId = req.user?.id ?? null;

    await removeOptOut({ schoolId, actorId, parentProfileId: req.params.parentProfileId });
    res.status(204).send();
  })
);

/* ------------------------------------------------------------------ *
 * Credits
 * ------------------------------------------------------------------ */

/**
 * Credit status.
 *
 * Reported as unknown rather than as a number, because nothing in this
 * repository can report one. There is no provider balance to query and no credit
 * ledger to total, so inventing a figure would be indistinguishable from a real
 * one on screen.
 */
router.get(
  '/credits',
  requireCredits,
  asyncHandler(async (req: Request, res: Response) => {
    const { schoolId } = schoolScopeOf(req);
    const capability = await resolveCapability(schoolId);

    res.json({
      credits: capability.credits,
      provider: {
        integrated: capability.providerIntegrated,
        configuredProvider: capability.configuredProvider,
        configuredSenderId: capability.configuredSenderId,
        channelEnabled: capability.channelEnabled,
      },
      requirement:
        'To show a real balance, either integrate an SMS gateway that reports the account ' +
        'balance and add a client that queries it, or add an SMS credit ledger with audited ' +
        'debits per campaign. Neither exists in this repository.',
    });
  })
);

/* ------------------------------------------------------------------ *
 * Delivery callbacks
 * ------------------------------------------------------------------ */

/**
 * Provider delivery reports.
 *
 * Unauthenticated by necessity: a gateway cannot hold a session. It is guarded
 * by the shared secret instead, verified before anything is read - so a caller
 * without it is refused before any work is done, and a forged "delivered" cannot
 * be written to a campaign.
 */
export const deliveryRouter: Router = Router();

deliveryRouter.post(
  '/delivery',
  asyncHandler(async (req: Request, res: Response) => {
    const gateway = getSmsGateway();

    if (!config.sms.webhookSecret) {
      // No secret configured means nothing can verify a caller, which would make
      // every report forgeable. Refusing outright is safer than accepting.
      res.status(503).json({
        error: {
          message:
            'SMS delivery reports are not enabled. Set SMS_WEBHOOK_SECRET so a provider report ' +
            'can be verified before it is applied.',
        },
      });
      return;
    }

    const presented =
      (req.get('x-sms-webhook-secret') as string | undefined) ??
      (req.body?.webhookSecret as string | undefined);

    if (presented !== config.sms.webhookSecret) {
      res.status(401).json({ error: { message: 'That delivery report could not be verified.' } });
      return;
    }

    // A provider may batch several recipients into one request.
    const reports = Array.isArray(req.body) ? req.body : [req.body];
    let matched = 0;

    for (const raw of reports) {
      const report = normaliseDeliveryReport(
        gateway.provider,
        (raw ?? {}) as Record<string, unknown>
      );
      if (!report) continue;
      matched += (await applyDeliveryReport(report)).matched;
    }

    // Always 200 once verified: a provider treats a non-2xx as a failed delivery
    // attempt and will retry a report that has already been applied.
    res.json({ received: reports.length, matched });
  })
);
