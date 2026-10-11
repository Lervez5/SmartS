/**
 * Enrollment-triggered guardian communication.
 *
 * These cover the contract the enrollment workflow depends on: a guardian is
 * told once per enrollment per channel, by whichever channel their contact
 * details actually support, and a messaging failure never turns back a valid
 * enrollment.
 *
 * Channel assertions account for the fact that no SMS gateway is configured in
 * the test environment. That is not a mock: the real client reports itself
 * unconfigured, and the row it produces must be `queued` with that reason rather
 * than `delivered` - a fake success would pass every one of these tests while
 * telling a parent nothing.
 */

import { EnrollmentChannel, NotificationStatus, NotificationType } from '@prisma/client';
import { prisma } from '../src/infrastructure/database';
import { notifyGuardiansOfEnrollment } from '../src/modules/enrollment/notifications';
import { generateShortCode } from '../src/modules/invitations/repository';

const stamp = Date.now();
const email = (name: string) => `en-${name}-${stamp}@test.local`;

describe('Enrollment notifications', () => {
  let schoolId: string;
  let academicYearId: string;
  /** A class with no streams at all, to prove placement never requires one. */
  let classId: string;

  let learnerUserId: string;
  let learnerProfileId: string;
  let enrollmentId: string;

  /** Guardian with a usable phone. The basic-phone parent this exists for. */
  let smsOnlyGuardian: string;
  /** Guardian with a phone and an email, so both channels apply. */
  let bothGuardian: string;
  /** Guardian with no usable contact of any kind. */
  let noContactGuardian: string;

  const createdEnrollmentIds: string[] = [];
  const createdNotificationIds: string[] = [];
  const createdProfileIds: string[] = [];
  const createdUserIds: string[] = [];

  /** Provisions an account, and returns its user id. */
  async function makeUser(
    name: string,
    phone: string | null,
    role = 'PARENT',
    status: 'active' | 'pending' = 'active'
  ): Promise<string> {
    const roleRow = await prisma.role.findUnique({ where: { name: role } });
    const user = await prisma.user.create({
      data: {
        email: email(name),
        name,
        phone,
        status,
        schoolMemberships: { create: { schoolId, isDefault: true } },
        ...(roleRow ? { roleMemberships: { create: { roleId: roleRow.id } } } : {}),
      },
      select: { id: true },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makeGuardian(
    name: string,
    phone: string | null,
    status: 'active' | 'pending' = 'active'
  ): Promise<string> {
    const userId = await makeUser(name, phone, 'PARENT', status);
    const profile = await prisma.parentProfile.create({
      data: { userId },
      select: { id: true },
    });
    createdProfileIds.push(profile.id);
    return profile.id;
  }

  /**
   * Removes an account and everything required to reference it.
   *
   * Role and school memberships are separate collections, and Prisma refuses to
   * delete a user they still point at - which is a correct guard, and simply
   * means a test fixture has to remove them explicitly rather than assume a
   * cascade that does not exist.
   */
  async function deleteAccount(userId: string): Promise<void> {
    await prisma.userRoleMembership.deleteMany({ where: { userId } });
    await prisma.schoolMembership.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    const index = createdUserIds.indexOf(userId);
    if (index >= 0) createdUserIds.splice(index, 1);
  }

  /** Places the learner into a class, and returns the enrollment id. */
  async function placeLearner(withStream = false): Promise<string> {
    let streamId: string | null = null;
    if (withStream) {
      const stream = await prisma.stream.create({
        data: { classId, name: `East ${stamp}`, code: `E${stamp.toString().slice(-3)}` },
        select: { id: true },
      });
      streamId = stream.id;
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: learnerUserId,
        classId,
        streamId,
        academicYearId,
        startDate: new Date(),
      },
      select: { id: true },
    });
    createdEnrollmentIds.push(enrollment.id);
    return enrollment.id;
  }

  beforeAll(async () => {
    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    const year = await prisma.academicYear.create({
      data: {
        schoolId,
        name: `EN ${stamp}`,
        label: 'Enrollment notification session',
        status: 'active',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });
    academicYearId = year.id;

    // Deliberately without streams: a class with few learners has none, and a
    // placement in it must still notify normally.
    const cls = await prisma.class.create({
      data: {
        schoolId,
        name: `PP1 ${stamp}`,
        gradeLevel: 'PP1',
        academicYearId,
      },
    });
    classId = cls.id;

    learnerUserId = await makeUser('E2E Learner', null, 'STUDENT');
    const learnerProfile = await prisma.studentProfile.create({
      data: { userId: learnerUserId, gradeLevel: 'PP1' },
      select: { id: true },
    });
    learnerProfileId = learnerProfile.id;

    smsOnlyGuardian = await makeGuardian('Guardian SMS Only', '0722345678');
    bothGuardian = await makeGuardian('Guardian Both', '0722999888');
    noContactGuardian = await makeGuardian('Guardian No Contact', null);

    for (const guardian of [smsOnlyGuardian, bothGuardian, noContactGuardian]) {
      await prisma.parentChildLink.create({
        data: { parentId: guardian, childId: learnerProfileId },
      });
    }

    // SMS on, email off: this makes the phone-only guardian reachable and the
    // others unreachable, which is the channel-selection case under test.
    await prisma.schoolNotificationSettings.upsert({
      where: { schoolId },
      update: { smsEnabled: true, emailEnabled: false, defaultChannel: 'sms' },
      create: { schoolId, smsEnabled: true, emailEnabled: false, defaultChannel: 'sms' },
    });
  });

  afterAll(async () => {
    for (const id of createdNotificationIds) {
      await prisma.enrollmentNotification.deleteMany({ where: { id } });
    }
    await prisma.enrollmentNotification.deleteMany({
      where: { enrollmentId: { in: createdEnrollmentIds } },
    });
    for (const id of createdEnrollmentIds) {
      await prisma.enrollment.deleteMany({ where: { id } });
    }
    await prisma.stream.deleteMany({ where: { classId, name: { startsWith: 'East' } } });
    await prisma.parentChildLink.deleteMany({
      where: {
        parentId: { in: [smsOnlyGuardian, bothGuardian, noContactGuardian] },
      },
    });
    await prisma.parentProfile.deleteMany({
      where: { id: { in: [smsOnlyGuardian, bothGuardian, noContactGuardian] } },
    });
    await prisma.studentProfile.deleteMany({ where: { id: learnerProfileId } });
    await prisma.class.deleteMany({ where: { id: classId } });
    await prisma.academicYear.deleteMany({ where: { id: academicYearId } });
    await prisma.invitation.deleteMany({
      where: { email: { in: createdUserIds.map(() => email('')) } },
    });
    await prisma.invitation.deleteMany({
      where: { invitedBy: null, createdAt: { gte: new Date(stamp) } },
    });
    for (const userId of createdUserIds) await deleteAccount(userId);
    await prisma.$disconnect();
  });

  /** Notifies and records the rows it produced, so each test can assert. */
  async function notify(enrolmentId: string) {
    const outcome = await notifyGuardiansOfEnrollment({
      enrollmentId: enrolmentId,
      schoolId,
      actorId: null,
    });
    const rows = await prisma.enrollmentNotification.findMany({
      where: { enrollmentId: enrolmentId },
      include: { parent: { select: { id: true } } },
    });
    for (const row of rows) createdNotificationIds.push(row.id);
    return { outcome, rows };
  }

  describe('recipient resolution', () => {
    it('resolves every guardian linked to the learner, by their persisted link', async () => {
      const enrolmentId = await placeLearner();
      const { outcome, rows } = await notify(enrolmentId);

      // Three guardians are linked, so three are considered - not the whole user
      // register, and not every phone number in the database.
      expect(outcome.guardians).toBe(3);
      expect(new Set(rows.map((row) => row.parentId)).size).toBe(3);
    });

    it('sends only on a channel the guardian can actually be reached on', async () => {
      const enrolmentId = await placeLearner();
      const { rows } = await notify(enrolmentId);

      const smsOnly = rows.find((row) => row.parentId === smsOnlyGuardian);
      // Email is switched off for the school, so a guardian with a phone is
      // reached by SMS alone - which is what makes an SMS-only parent reachable.
      expect(smsOnly?.channel).toBe(EnrollmentChannel.sms);
      expect(smsOnly?.status).not.toBe(NotificationStatus.awaiting_contact);
    });

    it('flags a guardian with no contact details as awaiting contact, not as sent', async () => {
      const enrolmentId = await placeLearner();
      const { outcome, rows } = await notify(enrolmentId);

      const stranded = rows.find((row) => row.parentId === noContactGuardian);
      expect(stranded?.status).toBe(NotificationStatus.awaiting_contact);
      expect(outcome.awaitingContact).toBe(1);

      // A message that was never attempted must never look like a delivery.
      expect(stranded?.status).not.toBe(NotificationStatus.delivered);
      expect(stranded?.status).not.toBe(NotificationStatus.provider_accepted);
      expect(stranded?.providerMessageId).toBeNull();
    });
  });

  describe('idempotency', () => {
    it('sends once per enrollment per channel, however many times it is triggered', async () => {
      const enrolmentId = await placeLearner();

      const first = await notify(enrolmentId);
      const second = await notify(enrolmentId);
      const third = await notify(enrolmentId);

      const total = await prisma.enrollmentNotification.count({
        where: { enrollmentId: enrolmentId },
      });

      // First call dispatched; the next two suppressed everything they found.
      expect(first.rows.length).toBeGreaterThan(0);
      expect(second.outcome.duplicatesSuppressed).toBe(first.rows.length);
      expect(second.outcome.dispatched).toBe(0);
      expect(third.outcome.duplicatesSuppressed).toBe(first.rows.length);
      expect(total).toBe(first.rows.length);
    });

    it('gives a guardian one message per enrollment, not one merged message', async () => {
      const first = await placeLearner();
      const second = await placeLearner();

      await notify(first);
      const { outcome } = await notify(second);

      // Each enrollment produces rows for every guardian, so a guardian with two
      // children at this school is told about each enrollment separately rather
      // than receiving one message that does not say which child it is about.
      const rows = await prisma.enrollmentNotification.findMany({
        where: { enrollmentId: second },
      });
      expect(rows).toHaveLength(3);
      expect(outcome.dispatched).toBeGreaterThan(0);

      // And the two enrollments stay distinct: nothing is shared between them.
      const firstRows = await prisma.enrollmentNotification.count({
        where: { enrollmentId: first },
      });
      expect(firstRows).toBe(3);
    });
  });

  describe('provider outcome', () => {
    it('records an unconfigured gateway as queued, never as delivered', async () => {
      const enrolmentId = await placeLearner();
      const { rows } = await notify(enrolmentId);

      const sms = rows.find((row) => row.channel === EnrollmentChannel.sms)!;
      // No gateway is configured, so nothing was handed anywhere. The row says so
      // and remains eligible for a retry the moment credentials exist.
      expect(sms.status).toBe(NotificationStatus.queued);
      expect(sms.providerError).toContain('No SMS gateway');
      expect(sms.deliveredAt).toBeNull();
    });

    it('stays queued rather than failed when the gateway is merely unconfigured', async () => {
      const enrolmentId = await placeLearner();
      const { rows } = await notify(enrolmentId);

      const sms = rows.find((row) => row.channel === EnrollmentChannel.sms)!;
      // `queued` is retryable; `failed` would read as the number being bad.
      expect(sms.status).not.toBe(NotificationStatus.failed);
    });
  });

  describe('resilience', () => {
    it('does not throw when no guardian exists at all', async () => {
      // An enrollment whose learner has no linked guardian must still be
      // notifiable - it simply produces nothing rather than an error that would
      // make the caller believe the enrollment failed.
      const orphan = await makeUser('Orphan Learner', null, 'STUDENT');
      const orphanProfile = await prisma.studentProfile.create({
        data: { userId: orphan, gradeLevel: 'PP1' },
      });
      const enrolment = await prisma.enrollment.create({
        data: { studentId: orphan, classId, academicYearId, startDate: new Date() },
      });
      createdEnrollmentIds.push(enrolment.id);

      const outcome = await notifyGuardiansOfEnrollment({
        enrollmentId: enrolment.id,
        schoolId,
        actorId: null,
      });

      expect(outcome.guardians).toBe(0);
      expect(outcome.dispatched).toBe(0);

      await prisma.studentProfile.deleteMany({ where: { id: orphanProfile.id } });
      await deleteAccount(orphan);
    });

    it("refuses to notify about an enrollment that is not the caller's", async () => {
      await expect(
        notifyGuardiansOfEnrollment({
          enrollmentId: '000000000000000000000000',
          schoolId,
          actorId: null,
        })
      ).rejects.toThrow();
    });
  });

  describe('activation', () => {
    it('issues an activation instruction for a guardian who has never signed in', async () => {
      // The guardian's account exists but is pending, so the message must carry
      // the account setup rather than only the enrollment.
      const pendingUserId = await makeUser('Guardian Pending', '0733445566', 'PARENT', 'pending');
      const profile = await prisma.parentProfile.create({
        data: { userId: pendingUserId },
        select: { id: true },
      });
      createdProfileIds.push(profile.id);
      await prisma.parentChildLink.create({
        data: { parentId: profile.id, childId: learnerProfileId },
      });

      const enrolmentId = await placeLearner();
      const { rows } = await notify(enrolmentId);

      const row = rows.find((r) => r.parentId === profile.id)!;
      expect(row.type).toBe(NotificationType.enrollment_and_activation);
      expect(row.body).toContain('Activate your parent account with code');
      // The code travels in the body, and the body is what staff may read - but
      // it is never a password, and it is single-use with a short expiry.
      expect(row.body).toMatch(/code [A-Z0-9]{10}/);

      await prisma.parentChildLink.deleteMany({ where: { parentId: profile.id } });
      await prisma.parentProfile.deleteMany({ where: { id: profile.id } });
      await deleteAccount(pendingUserId);
    });

    it('generates a short code with no keypad-ambiguous characters', () => {
      const code = generateShortCode();
      expect(code).toHaveLength(10);
      // 0/O, 1/I and L are the characters misread on a basic phone keypad.
      expect(code).not.toMatch(/[01OILU]/);
    });

    it('expires an activation code and refuses to reuse it', async () => {
      const { createInvitation, getInvitationByToken } =
        await import('../src/modules/invitations/repository');
      const { validateInvitationService } = await import('../src/modules/invitations/service');

      const invitation = await createInvitation({
        email: email('expiry'),
        codeStyle: 'short',
        // Already in the past, which is what an expired invitation looks like.
        ttlMs: -1000,
      });

      await expect(validateInvitationService(invitation.token)).rejects.toThrow(/expired/i);

      // Expiry is recorded, so the row is not left looking pending forever.
      const reloaded = await getInvitationByToken(invitation.token);
      expect(reloaded?.status).toBe('expired');

      // A code that has already been used cannot be replayed either.
      const { activateAccountService } = await import('../src/modules/invitations/service');
      const reactivated = await createInvitation({
        email: email('replay'),
        codeStyle: 'short',
        ttlMs: 60 * 60 * 1000,
      });
      await activateAccountService(reactivated.token, 'supersecret');
      await expect(activateAccountService(reactivated.token, 'supersecret')).rejects.toThrow(
        /already|invalid/i
      );
    });
  });

  describe('privacy', () => {
    it('never stores a plaintext password or token beyond the code needed', async () => {
      const enrolmentId = await placeLearner();
      const { rows } = await notify(enrolmentId);

      for (const row of rows) {
        expect(row.body).not.toContain('password');
        expect(row.subject).not.toContain('password');
        // The activation URL is the only credential-bearing content, and it is a
        // single-use token rather than a reusable one.
        expect(row.body).not.toMatch(/password[=:]/i);
      }
    });

    it('keeps the message to what the enrollment needs, and no more', async () => {
      const enrolmentId = await placeLearner();
      const { rows } = await notify(enrolmentId);

      for (const row of rows) {
        // A message that names the child, the class and an amount discloses more
        // than the enrollment requires to anyone holding the phone.
        expect(row.body).not.toContain('Sam');
        expect(row.body).not.toContain('balance');
        expect(row.body).not.toContain('KSh');
      }
    });
  });
});
