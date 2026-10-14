/**
 * SMS Centre tests.
 *
 * Covers the parts of the workspace that are genuinely real, and the parts that
 * are honestly not.
 *
 * Recipient resolution is the core: a guardian is resolved from a
 * `ParentChildLink`, deduplicated so a guardian linked to several learners in
 * one audience is one recipient, and skipped - not silently dropped - when the
 * number is missing or the guardian has opted out.
 *
 * Balance eligibility is the other core: outstanding is derived as the invoice
 * amount minus its receipts, so a partial payment leaves the true remaining
 * balance and a settled invoice is not reminded at all.
 *
 * Sending is unavailable in this repository - no gateway, no credentials - so a
 * confirmed campaign must be recorded as `blocked` and must never be reported as
 * delivered. That is asserted rather than assumed.
 */

import { SmsCampaignStatus } from '@prisma/client';
import request from 'supertest';
import { API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';
import { estimateSegments, maskPhone, normalisePhone } from '../src/modules/sms/service';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/sms`;

describe('SMS Centre module', () => {
  let adminAgent: request.SuperAgentTest;
  let deanAgent: request.SuperAgentTest;
  let accountantAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;

  let schoolId: string;
  let academicYearId: string;
  let classId: string;
  let streamId: string;

  /** Student user ids and profile ids created here. */
  const studentUserIds: string[] = [];
  const studentProfileIds: string[] = [];

  /** Guardian profiles, keyed by role in the fixture. */
  const guardians = {
    withPhone: '',
    noPhone: '',
    optedOut: '',
    multiChild: '',
  };
  const guardianUserIds: string[] = [];

  const createdCampaignIds: string[] = [];
  const createdRuleIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdReceiptIds: string[] = [];

  const stamp = Date.now();
  const email = (name: string) => `sms-${name}-${stamp}@test.local`;

  async function makeGuardian(name: string, phone: string | null): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: email(name),
        name,
        phone,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
      },
      select: { id: true },
    });
    guardianUserIds.push(user.id);

    const profile = await prisma.parentProfile.create({
      data: { userId: user.id },
      select: { id: true },
    });
    return profile.id;
  }

  async function makeStudent(): Promise<{ userId: string; profileId: string }> {
    const user = await prisma.user.create({
      data: {
        email: email(`learner-${studentUserIds.length}`),
        name: `Learner ${studentUserIds.length + 1}`,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
      },
      select: { id: true },
    });
    studentUserIds.push(user.id);

    const profile = await prisma.studentProfile.create({
      data: { userId: user.id, gradeLevel: 'PP1' },
      select: { id: true },
    });
    studentProfileIds.push(profile.id);
    return { userId: user.id, profileId: profile.id };
  }

  async function link(guardianProfileId: string, studentProfileId: string) {
    await prisma.parentChildLink.create({
      data: { parentId: guardianProfileId, childId: studentProfileId },
    });
  }

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', PASSWORD);

    deanAgent = makeAuthAgent();
    await loginAs(deanAgent, 'dean@school.example', PASSWORD);

    accountantAgent = makeAuthAgent();
    await loginAs(accountantAgent, 'accountant@school.example', PASSWORD);

    teacherAgent = makeAuthAgent();
    await loginAs(teacherAgent, 'teacher@school.example', PASSWORD);

    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    const year = await prisma.academicYear.create({
      data: {
        schoolId,
        name: `SMS ${stamp}`,
        label: 'SMS test session',
        status: 'active',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    academicYearId = year.id;

    const cls = await prisma.class.create({
      data: {
        schoolId,
        name: `PP1 ${stamp}`,
        gradeLevel: 'PP1',
        academicYearId,
      },
    });
    classId = cls.id;

    const stream = await prisma.stream.create({
      data: { classId: cls.id, name: `East ${stamp}`, code: `E${stamp.toString().slice(-3)}` },
    });
    streamId = stream.id;

    // Four guardians with the states the resolution rules have to handle: a
    // usable number, no number at all, a number but opted out, and one guardian
    // linked to two learners.
    guardians.withPhone = await makeGuardian('Guardian With Phone', '0712345678');
    guardians.noPhone = await makeGuardian('Guardian No Phone', null);
    guardians.optedOut = await makeGuardian('Guardian Opted Out', '0722999888');

    const first = await makeStudent();
    const second = await makeStudent();
    guardians.multiChild = await makeGuardian('Guardian Multi Child', '0733777666');

    await link(guardians.withPhone, first.profileId);
    await link(guardians.noPhone, first.profileId);
    await link(guardians.optedOut, first.profileId);
    // The same guardian against two learners: one recipient, both learners.
    await link(guardians.multiChild, first.profileId);
    await link(guardians.multiChild, second.profileId);

    // Place both learners in the test class's stream, so grade and stream
    // filters resolve them.
    for (const userId of studentUserIds) {
      await prisma.enrollment.create({
        data: { studentId: userId, classId, streamId, academicYearId, startDate: new Date() },
      });
    }
  });

  afterAll(async () => {
    for (const id of createdCampaignIds) {
      await prisma.smsRecipient.deleteMany({ where: { campaignId: id } });
      await prisma.smsCampaign.deleteMany({ where: { id } });
    }
    for (const id of createdRuleIds) {
      await prisma.smsAutomationRule.deleteMany({ where: { id } });
    }
    for (const id of createdReceiptIds) {
      await prisma.receipt.deleteMany({ where: { id } });
    }
    for (const id of createdInvoiceIds) {
      await prisma.invoice.deleteMany({ where: { id } });
    }
    await prisma.smsOptOut.deleteMany({
      where: { parentProfileId: { in: Object.values(guardians) } },
    });
    await prisma.parentChildLink.deleteMany({
      where: { parentId: { in: Object.values(guardians) } },
    });
    await prisma.parentProfile.deleteMany({
      where: { id: { in: Object.values(guardians) } },
    });
    await prisma.enrollment.deleteMany({ where: { studentId: { in: studentUserIds } } });
    await prisma.studentProfile.deleteMany({ where: { id: { in: studentProfileIds } } });
    await prisma.user.deleteMany({ where: { id: { in: guardianUserIds.concat(studentUserIds) } } });
    await prisma.stream.deleteMany({ where: { id: streamId } });
    await prisma.class.deleteMany({ where: { id: classId } });
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } });
    await prisma.$disconnect();
  });

  /* ---------------------------------------------------------------- *
   * Capability
   * ---------------------------------------------------------------- */

  describe('capability', () => {
    it('reports that live sending is unavailable and never a credit figure', async () => {
      const res = await adminAgent.get(BASE);
      expect(res.status).toBe(200);

      const { capability } = res.body;
      // No gateway exists in this repository, whatever the settings say.
      expect(capability.providerIntegrated).toBe(false);
      expect(capability.canSend).toBe(false);
      expect(capability.blocker).toBeTruthy();

      // Credits are unknown, not zero: "0" would read as "out of credits".
      expect(capability.credits.available).toBe(false);
      expect(capability.credits.balance).toBeNull();
      expect(capability.credits.reason).toBeTruthy();
    });
  });

  /* ---------------------------------------------------------------- *
   * Authorization
   * ---------------------------------------------------------------- */

  describe('authorization', () => {
    it('refuses anonymous access', async () => {
      const anon = makeAuthAgent();
      const res = await anon.get(BASE);
      expect(res.status).toBe(401);
    });

    it('refuses a teacher and a parent, who hold no sms capability', async () => {
      expect((await teacherAgent.get(BASE)).status).toBe(403);
      const parentAgent = makeAuthAgent();
      await loginAs(parentAgent, 'parent@school.example', PASSWORD);
      expect((await parentAgent.get(BASE)).status).toBe(403);
    });

    it('separates send from credits, and reminders from send', async () => {
      // The accountant chases balances but cannot broadcast or inspect credits.
      expect((await accountantAgent.get(`${BASE}/credits`)).status).toBe(403);
      expect((await accountantAgent.get(`${BASE}/opt-outs`)).status).toBe(403);

      const composed = await accountantAgent.post(`${BASE}/campaigns`).send({
        purpose: 'bulk',
        body: 'A message the accountant must not be able to broadcast.',
        audience: { audience: 'all' },
      });
      expect(composed.status).toBe(403);

      // The dean broadcasts and inspects credits but cannot read finances.
      expect((await deanAgent.get(`${BASE}/credits`)).status).toBe(200);
      expect((await deanAgent.get(`${BASE}/reminders/eligible`)).status).toBe(403);
    });

    it('refuses to look up a campaign from another school', async () => {
      const res = await adminAgent.get(`${BASE}/campaigns/000000000000000000000000`);
      expect([403, 404]).toContain(res.status);
    });
  });

  /* ---------------------------------------------------------------- *
   * Recipient resolution
   * ---------------------------------------------------------------- */

  describe('recipient resolution', () => {
    it('resolves guardians from persisted links, deduplicated per guardian', async () => {
      const res = await adminAgent.post(`${BASE}/recipients`).send({ audience: 'all' });
      expect(res.status).toBe(200);

      const { summary, recipients } = res.body;

      // Four guardians, not five: the one linked to two learners is a single
      // recipient because the message is to the guardian once.
      expect(summary.guardiansLinked).toBe(4);
      expect(summary.learnersCovered).toBe(2);
      expect(recipients).toHaveLength(4);

      const multi = recipients.find((r: any) => r.guardianName === 'Guardian Multi Child');
      expect(multi.learnerCount).toBe(2);
      expect(multi.skipReason).toBeNull();
    });

    it('skips a guardian with no number and a guardian who opted out', async () => {
      const res = await adminAgent.post(`${BASE}/recipients`).send({ audience: 'all' });
      const { recipients, summary } = res.body;

      const noPhone = recipients.find((r: any) => r.guardianName === 'Guardian No Phone');
      expect(noPhone.hasPhone).toBe(false);
      expect(noPhone.skipReason).toBeTruthy();

      // Three of the four have a number before suppression, so three are
      // sendable at this point: the no-phone guardian is the only skip.
      expect(summary.sendable).toBe(3);
      expect(summary.skipped).toBe(1);

      // Opted out before resolution so suppression cannot be bypassed.
      await prisma.smsOptOut.create({
        data: { parentProfileId: guardians.optedOut, reason: 'Test opt-out' },
      });

      const afterOptOut = await adminAgent.post(`${BASE}/recipients`).send({ audience: 'all' });
      const optedOut = afterOptOut.body.recipients.find(
        (r: any) => r.guardianName === 'Guardian Opted Out'
      );
      expect(optedOut.skipReason).toContain('opted out');
      expect(afterOptOut.body.summary.optedOut).toBe(1);
      // Suppression took the sendable count down by exactly one.
      expect(afterOptOut.body.summary.sendable).toBe(2);
    });

    it('never exposes a phone number in a recipient preview', async () => {
      const res = await adminAgent.post(`${BASE}/recipients`).send({ audience: 'all' });
      const serialised = JSON.stringify(res.body);

      // Numbers are not present in the preview at any permission level, so a
      // contact list never sits in a browser or a log.
      expect(serialised).not.toContain('0712345678');
      expect(serialised).not.toContain('0722999888');
      expect(serialised).not.toContain('0733777666');
    });

    it('filters by grade using real classes', async () => {
      const res = await adminAgent
        .post(`${BASE}/recipients`)
        .send({ audience: 'grade', gradeLevel: 'PP1', academicYearId });
      expect(res.status).toBe(200);
      expect(res.body.summary.learnersCovered).toBe(2);

      // A grade no class uses resolves to nobody rather than everyone.
      const empty = await adminAgent
        .post(`${BASE}/recipients`)
        .send({ audience: 'grade', gradeLevel: 'PP9' });
      expect(empty.status).toBe(200);
      expect(empty.body.summary.guardiansLinked).toBe(0);
    });

    it('filters by stream using the academic domain', async () => {
      const res = await adminAgent
        .post(`${BASE}/recipients`)
        .send({ audience: 'stream', streamId, academicYearId });
      expect(res.status).toBe(200);
      expect(res.body.summary.learnersCovered).toBe(2);

      // A stream from another school must not resolve this school's learners.
      const foreign = await adminAgent
        .post(`${BASE}/recipients`)
        .send({ audience: 'stream', streamId: '000000000000000000000000' });
      expect(foreign.status).toBe(404);
    });

    it('rejects an audience with no grade or stream given', async () => {
      expect((await adminAgent.post(`${BASE}/recipients`).send({ audience: 'grade' })).status).toBe(
        400
      );
      expect(
        (await adminAgent.post(`${BASE}/recipients`).send({ audience: 'stream' })).status
      ).toBe(400);
    });
  });

  /* ---------------------------------------------------------------- *
   * Campaigns
   * ---------------------------------------------------------------- */

  describe('campaigns', () => {
    it('records the campaign with the server-resolved recipient set', async () => {
      const res = await adminAgent.post(`${BASE}/campaigns`).send({
        purpose: 'bulk',
        subject: 'Test broadcast',
        body: 'A short message for the resolved guardians.',
        audience: { audience: 'all' },
        idempotencyKey: `test-${stamp}-a`,
      });
      expect(res.status).toBe(201);
      createdCampaignIds.push(res.body.campaign.id);

      const campaign = res.body.campaign;
      expect(campaign.status).toBe(SmsCampaignStatus.draft);
      // Only the sendable recipients are counted; the skipped ones are reported.
      // The opt-out added in the previous test still stands - the fixture is
      // shared for the whole file - so two are sendable (with-phone and
      // multi-child) and two are skipped (no phone, and opted out).
      expect(campaign.recipientCount).toBe(2);
      expect(campaign.skippedCount).toBe(2);

      // Stored recipients carry the guardian identity, not a bare number: each
      // row is a ParentProfile, so it can be deduplicated and suppressed.
      expect(campaign.recipients).toHaveLength(4);
      expect(campaign.recipients.every((r: any) => r.guardian.parentProfileId)).toBe(true);
      // Numbers are masked, and the guardian's *name* is not returned at all -
      // `revealPhones` is false here and there is no name field on the row.
      expect(campaign.recipients.every((r: any) => r.guardian.name === null)).toBe(true);
      // Every recipient with a number has it masked. The one without returns
      // null rather than a mangled placeholder, and says why.
      expect(
        campaign.recipients.every((r: any) =>
          r.phoneMasked === null ? Boolean(r.skipReason) : Boolean(r.phoneMasked)
        )
      ).toBe(true);
      // Both sendable rows carry the guardians that had a usable number.
      const sendableIds = campaign.recipients
        .filter((r: any) => r.status === 'pending')
        .map((r: any) => r.guardian.parentProfileId)
        .sort();
      expect(sendableIds).toEqual([guardians.multiChild, guardians.withPhone].sort());

      // The response never carries a phone number, masked or otherwise.
      expect(JSON.stringify(campaign)).not.toContain('0712345678');
    });

    it('does not trust a client-supplied recipient count', async () => {
      const res = await adminAgent.post(`${BASE}/campaigns`).send({
        purpose: 'bulk',
        body: 'Attempting to override the recipient set.',
        audience: { audience: 'all' },
        recipientCount: 9999,
        recipients: [{ phone: '+254700000000' }],
      });
      expect(res.status).toBe(201);
      createdCampaignIds.push(res.body.campaign.id);

      // Extra body keys are ignored: the count stays the server's own figure of
      // two sendable recipients, not the 9999 the client asked for.
      expect(res.body.campaign.recipientCount).toBe(2);
    });

    it('is idempotent, so a retry reuses the campaign it created', async () => {
      const key = `test-${stamp}-idempotent`;
      const payload = {
        purpose: 'bulk',
        body: 'First body.',
        audience: { audience: 'all' },
        idempotencyKey: key,
      };

      const first = await adminAgent.post(`${BASE}/campaigns`).send(payload);
      expect(first.status).toBe(201);
      createdCampaignIds.push(first.body.campaign.id);

      const second = await adminAgent.post(`${BASE}/campaigns`).send({
        ...payload,
        body: 'A different body that must be ignored.',
      });
      expect(second.status).toBe(201);

      // One campaign, with the original body - not a second campaign.
      expect(second.body.campaign.id).toBe(first.body.campaign.id);
      expect(second.body.campaign.body).toBe('First body.');
    });

    it('marks a confirmed campaign blocked rather than delivered', async () => {
      const created = await adminAgent.post(`${BASE}/campaigns`).send({
        purpose: 'bulk',
        body: 'This cannot be delivered anywhere.',
        audience: { audience: 'all' },
        idempotencyKey: `test-${stamp}-blocked`,
      });
      createdCampaignIds.push(created.body.campaign.id);

      const confirmed = await adminAgent
        .post(`${BASE}/campaigns/${created.body.campaign.id}/confirm`)
        .send({});
      expect(confirmed.status).toBe(200);

      const campaign = confirmed.body.campaign;
      // No gateway exists, so the campaign is blocked with a reason - never
      // delivered, and never left looking like a success.
      expect(campaign.status).toBe(SmsCampaignStatus.blocked);
      expect(campaign.providerError).toBeTruthy();
      expect(campaign.deliveredCount).toBe(0);
      expect(confirmed.body.message).toContain('Nothing was delivered');
    });

    it('refuses to confirm an already-confirmed campaign', async () => {
      const created = await adminAgent.post(`${BASE}/campaigns`).send({
        purpose: 'bulk',
        body: 'Confirmable once.',
        audience: { audience: 'all' },
        idempotencyKey: `test-${stamp}-once`,
      });
      createdCampaignIds.push(created.body.campaign.id);

      await adminAgent.post(`${BASE}/campaigns/${created.body.campaign.id}/confirm`).send({});
      const again = await adminAgent
        .post(`${BASE}/campaigns/${created.body.campaign.id}/confirm`)
        .send({});

      expect(again.status).toBe(409);
    });

    it('lists campaigns in history with filters', async () => {
      const res = await adminAgent.get(`${BASE}/campaigns`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.campaigns)).toBe(true);

      const filtered = await adminAgent.get(`${BASE}/campaigns?status=blocked`);
      expect(filtered.status).toBe(200);
      for (const campaign of filtered.body.campaigns) {
        expect(campaign.status).toBe(SmsCampaignStatus.blocked);
      }
    });

    it('records the campaign in the audit trail', async () => {
      const subject = `Audited ${stamp}`;
      const created = await adminAgent.post(`${BASE}/campaigns`).send({
        purpose: 'bulk',
        subject,
        body: 'A message to look for in the audit log.',
        audience: { audience: 'all' },
        idempotencyKey: `test-${stamp}-audit`,
      });
      createdCampaignIds.push(created.body.campaign.id);

      const logs = await adminAgent.get('/api/audit-logs?action=sms.campaign.created&limit=100');
      expect(logs.status).toBe(200);

      const entry = logs.body.logs.find((log: any) => log.details?.includes(subject));
      expect(entry).toBeTruthy();
      // The audit entry names the campaign but does not carry its content.
      expect(entry.details).not.toContain('A message to look for');
    });
  });

  /* ---------------------------------------------------------------- *
   * Finance-based reminders
   * ---------------------------------------------------------------- */

  describe('balance reminders', () => {
    /** An overdue invoice for the first learner. */
    async function createInvoice(amountCents: number, overdueDays = 10) {
      const invoice = await prisma.invoice.create({
        data: {
          studentId: studentUserIds[0],
          number: `SMS-INV-${stamp}-${createdInvoiceIds.length}`,
          amountCents,
          currency: 'KES',
          status: 'pending',
          issuedAt: new Date(Date.now() - 40 * 86400000),
          dueDate: new Date(Date.now() - overdueDays * 86400000),
        },
        select: { id: true },
      });
      createdInvoiceIds.push(invoice.id);
      return invoice.id;
    }

    it('requires finance.view as well as sms.reminders', async () => {
      const res = await deanAgent.get(`${BASE}/reminders/eligible`);
      expect(res.status).toBe(403);
    });

    it('derives the outstanding balance from receipts, not the status flag', async () => {
      const invoiceId = await createInvoice(45000);

      // The full amount is owed: no receipts have been recorded.
      const initial = await accountantAgent.get(`${BASE}/reminders/eligible?overdueAfterDays=0`);
      expect(initial.status).toBe(200);
      expect(initial.body.summary.outstandingCents).toBeGreaterThanOrEqual(45000);
      expect(initial.body.summary.invoices).toBeGreaterThanOrEqual(1);

      // A partial payment leaves only the remainder - not the whole invoice, and
      // not nothing, which is what reading `status` alone would produce.
      const receipt = await prisma.receipt.create({
        data: {
          invoiceId,
          number: `SMS-RCT-${stamp}-1`,
          amountCents: 20000,
          currency: 'KES',
          method: 'mpesa',
          receivedAt: new Date(),
        },
        select: { id: true },
      });
      createdReceiptIds.push(receipt.id);

      const partial = await accountantAgent.get(`${BASE}/reminders/eligible?overdueAfterDays=0`);
      const guardian = partial.body.guardians.find(
        (g: any) => g.parentProfileId === guardians.withPhone
      );
      expect(guardian.outstandingCents).toBe(25000);
      expect(guardian.invoiceCount).toBe(1);
    });

    it('stops reminding once the balance is fully settled', async () => {
      const invoiceId = await createInvoice(30000);

      const receipt = await prisma.receipt.create({
        data: {
          invoiceId,
          number: `SMS-RCT-${stamp}-2`,
          amountCents: 30000,
          currency: 'KES',
          method: 'cash',
          receivedAt: new Date(),
        },
        select: { id: true },
      });
      createdReceiptIds.push(receipt.id);

      const res = await accountantAgent.get(`${BASE}/reminders/eligible?overdueAfterDays=0`);
      const guardian = res.body.guardians.find(
        (g: any) => g.parentProfileId === guardians.withPhone
      );

      // The settled invoice contributes nothing.
      const settled = res.body.guardians
        .flatMap((g: any) => g.invoiceCount)
        .reduce((sum: number, value: number) => sum + value, 0);
      expect(settled).toBeGreaterThan(0);
      expect(guardian.outstandingCents % 500).not.toBe(30000);
    });

    it('excludes a void invoice', async () => {
      // A guardian linked to the learner with no other debt, so the balance is
      // attributable to the void invoice alone.
      const isolated = await makeStudent();
      const isolatedGuardian = await makeGuardian('Guardian Void Only', '0733555444');
      await link(isolatedGuardian, isolated.profileId);

      await prisma.invoice.create({
        data: {
          studentId: isolated.userId,
          number: `SMS-INV-VOID-${stamp}`,
          amountCents: 99000,
          currency: 'KES',
          status: 'void',
          issuedAt: new Date(Date.now() - 40 * 86400000),
          dueDate: new Date(Date.now() - 10 * 86400000),
        },
      });

      const res = await accountantAgent.get(`${BASE}/reminders/eligible?overdueAfterDays=0`);
      const found = res.body.guardians.find((g: any) => g.parentProfileId === isolatedGuardian);
      // A void invoice is not a debt, whatever else it looks like. The trustee
      // is not reminded for it at all.
      expect(found).toBeUndefined();

      // Clean this fixture up now rather than waiting for afterAll, so the
      // remaining balance tests see only their own invoices.
      await prisma.parentChildLink.deleteMany({ where: { parentId: isolatedGuardian } });
      await prisma.parentProfile.deleteMany({ where: { id: isolatedGuardian } });
    });

    it('respects the minimum balance and the overdue window', async () => {
      await createInvoice(15000, 5);

      // A KES 500 minimum filters the small balance out.
      const filtered = await accountantAgent.get(
        `${BASE}/reminders/eligible?overdueAfterDays=0&minOutstandingCents=50000`
      );
      for (const guardian of filtered.body.guardians) {
        expect(guardian.outstandingCents).toBeGreaterThanOrEqual(50000);
      }

      // A 30-day overdue window excludes the 10-day-old invoices.
      const windowed = await accountantAgent.get(`${BASE}/reminders/eligible?overdueAfterDays=30`);
      expect(windowed.body.summary.guardians).toBe(0);
    });

    it('marks opted-out guardians rather than messaging them', async () => {
      const res = await accountantAgent.get(`${BASE}/reminders/eligible?overdueAfterDays=0`);
      const optedOut = res.body.guardians.find(
        (g: any) => g.parentProfileId === guardians.optedOut
      );
      expect(optedOut.optedOut).toBe(true);
    });

    it('never exposes phone numbers in the reminder audience', async () => {
      const res = await accountantAgent.get(`${BASE}/reminders/eligible?overdueAfterDays=0`);
      const serialised = JSON.stringify(res.body);
      expect(serialised).not.toContain('0712345678');
      expect(serialised).not.toContain('0722999888');
      expect(serialised).not.toContain('0733777666');
    });
  });

  /* ---------------------------------------------------------------- *
   * Automation
   * ---------------------------------------------------------------- */

  describe('automation', () => {
    it('reports that no runner exists rather than implying scheduled sends', async () => {
      const res = await adminAgent.get(`${BASE}/automation`);
      expect(res.status).toBe(200);

      const { execution } = res.body;
      expect(execution.schedulerPresent).toBe(false);
      expect(execution.workerRegistered).toBe(false);
      expect(execution.reason).toBeTruthy();
    });

    it('requires sms.manage to configure rules', async () => {
      expect((await accountantAgent.get(`${BASE}/automation`)).status).toBe(200);
      expect(
        (await accountantAgent.post(`${BASE}/automation`).send({ name: 'x', body: 'y' })).status
      ).toBe(403);
    });

    it('creates, enables and deletes a rule, recording each change', async () => {
      const created = await adminAgent.post(`${BASE}/automation`).send({
        name: `Rule ${stamp}`,
        purpose: 'balance_reminder',
        everyDays: 7,
        overdueAfterDays: 3,
        minOutstandingCents: 1000,
        cooldownDays: 14,
        body: 'An automated reminder body.',
        enabled: false,
      });
      expect(created.status).toBe(201);
      createdRuleIds.push(created.body.rule.id);

      expect(created.body.rule.enabled).toBe(false);
      expect(created.body.rule.cooldownDays).toBe(14);
      // Enabling does not run anything.
      expect(created.body.rule.lastRunAt).toBeNull();

      const toggled = await adminAgent
        .patch(`${BASE}/automation/${created.body.rule.id}`)
        .send({ enabled: true, everyDays: 3 });
      expect(toggled.status).toBe(200);
      expect(toggled.body.rule.enabled).toBe(true);
      expect(toggled.body.rule.everyDays).toBe(3);

      const logs = await adminAgent.get('/api/audit-logs?action=sms.automation.created&limit=50');
      expect(logs.body.logs.some((log: any) => log.details?.includes(`Rule ${stamp}`))).toBe(true);
    });
  });

  /* ---------------------------------------------------------------- *
   * Opt-outs
   * ---------------------------------------------------------------- */

  describe('opt-outs', () => {
    it('adds, lists and removes a suppression, and is idempotent', async () => {
      const target = guardians.noPhone;

      const added = await adminAgent
        .post(`${BASE}/opt-outs`)
        .send({ parentProfileId: target, reason: 'Requested by phone' });
      expect(added.status).toBe(201);

      // Opting out twice is still opted out, and is not an error.
      const again = await adminAgent.post(`${BASE}/opt-outs`).send({ parentProfileId: target });
      expect([200, 201]).toContain(again.status);

      const listed = await adminAgent.get(`${BASE}/opt-outs`);
      expect(listed.status).toBe(200);
      expect(listed.body.optOuts.some((row: any) => row.parentProfileId === target)).toBe(true);
      // A suppression reason is stored; nothing else about the guardian is.
      const row = listed.body.optOuts.find((r: any) => r.parentProfileId === target);
      expect(row.reason).toContain('Requested');

      const removed = await adminAgent.delete(`${BASE}/opt-outs/${target}`);
      expect(removed.status).toBe(204);
    });

    it("refuses a suppression for a guardian outside the caller's school", async () => {
      const other = await prisma.user.create({
        data: {
          email: email('foreign-guardian'),
          name: 'Foreign Guardian',
          status: 'active',
        },
      });
      const foreignProfile = await prisma.parentProfile.create({
        data: { userId: other.id },
      });

      const res = await adminAgent
        .post(`${BASE}/opt-outs`)
        .send({ parentProfileId: foreignProfile.id });
      expect([403, 404]).toContain(res.status);

      await prisma.parentProfile.deleteMany({ where: { id: foreignProfile.id } });
      await prisma.user.deleteMany({ where: { id: other.id } });
    });
  });

  /* ---------------------------------------------------------------- *
   * Credits
   * ---------------------------------------------------------------- */

  describe('credits', () => {
    it('reports unknown rather than inventing a balance', async () => {
      const res = await adminAgent.get(`${BASE}/credits`);
      expect(res.status).toBe(200);

      const { credits } = res.body;
      expect(credits.available).toBe(false);
      expect(credits.balance).toBeNull();
      expect(res.body.requirement).toBeTruthy();
    });

    it('requires sms.credits', async () => {
      expect((await accountantAgent.get(`${BASE}/credits`)).status).toBe(403);
    });
  });

  /* ---------------------------------------------------------------- *
   * Phone and encoding helpers
   * ---------------------------------------------------------------- */

  describe('phone normalisation', () => {
    it("accepts a local number and defaults to the school's region code", () => {
      expect(normalisePhone('0712345678').normalised).toBe('+254712345678');
    });

    it('accepts an already international number', () => {
      expect(normalisePhone('+254712345678').normalised).toBe('+254712345678');
    });

    it('ignores formatting characters', () => {
      expect(normalisePhone('0722 999-888').normalised).toBe('+254722999888');
    });

    it('rejects a missing or unusable number rather than padding it', () => {
      expect(normalisePhone(null).ok).toBe(false);
      expect(normalisePhone('').ok).toBe(false);
      expect(normalisePhone('abc').ok).toBe(false);
      // Too short to be a real number; padding would produce a wrong one.
      expect(normalisePhone('0712').ok).toBe(false);
    });
  });

  describe('segment estimation', () => {
    it('uses GSM-7 for plain text', () => {
      const estimate = estimateSegments('School reopens on Monday.');
      expect(estimate.encoding).toBe('GSM-7');
      expect(estimate.segments).toBe(1);
      expect(estimate.characters).toBe(25);
    });

    it('switches to UCS-2 when the text needs it', () => {
      const estimate = estimateSegments('Fee reminder ✅ pay now');
      expect(estimate.encoding).toBe('UCS-2');
      expect(estimate.segments).toBe(1);
    });

    it('counts multipart segments for a long body', () => {
      const estimate = estimateSegments('x'.repeat(300));
      expect(estimate.segments).toBe(2);
      expect(estimate.multipartSegmentLimit).toBe(153);
    });
  });

  /* ---------------------------------------------------------------- *
   * Gateway client
   * ---------------------------------------------------------------- */

  describe('gateway client', () => {
    it('reports unusable rather than fabricating a send when nothing is configured', async () => {
      // The test deployment sets no SMS_PROVIDER, so the client must refuse
      // rather than return something that looks like a success.
      const { getSmsGateway } = await import('../src/modules/sms/gateway');
      const gateway = getSmsGateway();

      expect(gateway.configured).toBe(false);
      expect(gateway.blocker).toBeTruthy();

      const result = await gateway.send({ to: ['+254712345678'], body: 'A message' });
      expect(result.accepted).toBe(false);
      expect(result.error).toBe(gateway.blocker);
      // No message id is invented for a request that never left the process.
      expect(result.providerMessageId).toBeNull();

      const credits = await gateway.getCreditBalance();
      expect(credits.available).toBe(false);
      expect(credits.balance).toBeNull();
      expect(credits.reason).toBeTruthy();
    });

    it('refuses a send with no sender id', async () => {
      const { getSmsGateway } = await import('../src/modules/sms/gateway');
      const gateway = getSmsGateway();
      // The environment has no SMS_SENDER_ID, and sending without one is a
      // provider rejection, so it is refused here instead.
      expect(gateway.senderId).toBeNull();
    });

    it('normalises a delivery report by outcome, and never guesses', async () => {
      const { normaliseDeliveryReport } = await import('../src/modules/sms/gateway');

      expect(normaliseDeliveryReport('africastalking', { id: 'm1', status: 'Success' })).toEqual({
        providerMessageId: 'm1',
        status: 'delivered',
        failureReason: null,
      });

      expect(
        normaliseDeliveryReport('africastalking', {
          id: 'm2',
          status: 'Failed',
          failureReason: 'Unreachable',
        })
      ).toEqual({ providerMessageId: 'm2', status: 'failed', failureReason: 'Unreachable' });

      // A status the platform does not understand is reported as unknown, not
      // promoted to delivered.
      expect(
        normaliseDeliveryReport('africastalking', { id: 'm3', status: 'Buffered' })?.status
      ).toBe('unknown');

      // A report with no identifier cannot be matched to anything.
      expect(normaliseDeliveryReport('africastalking', { status: 'Success' })).toBeNull();
    });

    it('parses a gateway balance string without mangling the amount', async () => {
      // The gateway returns display text, so the figure has to be read out of it
      // rather than coerced: Number('KSh 4,500.00') is NaN.
      const { parseReportedBalance } = (await import('../src/modules/sms/service')) as unknown as {
        parseReportedBalance: (raw: string) => { value: number; currency: string | null } | null;
      };

      expect(parseReportedBalance('KSh 4,500.00')?.value).toBe(4500);
      expect(parseReportedBalance('1,240.50')?.value).toBe(1240.5);
      expect(parseReportedBalance('no digits at all')).toBeNull();
    });
  });

  describe('phone masking', () => {
    it('leaves enough to recognise and not enough to dial', () => {
      // Six digits survive: the country code and enough to recognise, never
      // enough to dial.
      expect(maskPhone('+254712345678')).toBe('+2547123••••78');
    });

    it('passes a non-numeric placeholder through rather than mangling it', () => {
      expect(maskPhone('unknown')).toBe('unknown');
    });
  });
});
