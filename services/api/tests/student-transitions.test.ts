/**
 * Student Transitions module tests.
 *
 * Covers the list endpoint with its filters, the options endpoint, recording an
 * exit, viewing a detail with the enrollment timeline, and restoring a learner.
 */

import request from 'supertest';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/student-transitions`;

const TEST_EMAILS = [
  'transitions.dean@school.example',
  'transitions.teacher@school.example',
  'transitions.student@school.example',
];

describe('Student Transitions module', () => {
  let adminAgent: request.SuperAgentTest;
  let deanAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;
  let studentAgent: request.SuperAgentTest;

  let schoolId: string;
  let studentId: string;
  let studentUserId: string;
  let academicYearId: string;
  let classId: string;
  let exitId: string;

  beforeAll(async () => {
    // Clean up any leftovers from a previous run
    await prisma.learnerExit.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.studentProfile.deleteMany({
      where: { user: { email: { in: TEST_EMAILS } } },
    });
    for (const email of TEST_EMAILS) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.schoolMembership.deleteMany({ where: { userId: u.id } });
        await prisma.userRoleMembership.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
      }
    }

    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', PASSWORD);

    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    const deanRole = await prisma.role.findUnique({ where: { name: 'DEAN' } });
    const teacherRole = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
    const studentRole = await prisma.role.findUnique({ where: { name: 'STUDENT' } });

    const deanHash = await import('argon2').then((m) => m.default.hash(PASSWORD));
    const deanUser = await prisma.user.create({
      data: {
        email: 'transitions.dean@school.example',
        name: 'Transitions Dean',
        passwordHash: deanHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: deanRole!.id } },
      },
    });

    const teacherHash = await import('argon2').then((m) => m.default.hash(PASSWORD));
    const teacherUser = await prisma.user.create({
      data: {
        email: 'transitions.teacher@school.example',
        name: 'Transitions Teacher',
        passwordHash: teacherHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: teacherRole!.id } },
      },
    });

    deanAgent = makeAuthAgent();
    await loginAs(deanAgent, 'transitions.dean@school.example', PASSWORD);

    teacherAgent = makeAuthAgent();
    await loginAs(teacherAgent, 'transitions.teacher@school.example', PASSWORD);

    // Create an academic year (session)
    const ay = await prisma.academicYear.create({
      data: {
        schoolId,
        name: '2026',
        label: '2026 Academic Session',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'active',
      },
    });
    academicYearId = ay.id;

    // Create a class for the session
    const cls = await prisma.class.create({
      data: {
        schoolId,
        name: 'Grade 7 East',
        classCode: 'G7E-TEST',
        gradeLevel: 'Grade 7',
        academicYearId,
        status: 'active',
      },
    });
    classId = cls.id;

    // Create a student user with a profile
    const studentHash = await import('argon2').then((m) => m.default.hash(PASSWORD));
    const studentUser = await prisma.user.create({
      data: {
        email: 'transitions.student@school.example',
        name: 'Transferred Student',
        passwordHash: studentHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: studentRole!.id } },
        studentProfile: {
          create: {
            gradeLevel: 'Grade 7',
            admissionId: '65f1c0e0f1c0e0f1c0e0f1c0',
            enrollmentDate: new Date('2026-02-15'),
            gender: 'female',
          },
        },
      },
    });
    studentUserId = studentUser.id;
    const profile = await prisma.studentProfile.findUnique({ where: { userId: studentUserId } });
    studentId = profile!.id;

    studentAgent = makeAuthAgent();
    await loginAs(studentAgent, 'transitions.student@school.example', PASSWORD);

    // Enroll the student in the class
    await prisma.enrollment.create({
      data: {
        studentId: studentUserId,
        classId,
        startDate: new Date('2026-02-15'),
        academicYearId,
      },
    });
  });

  afterAll(async () => {
    // Full cleanup
    await prisma.learnerExit.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.class.deleteMany({ where: { schoolId } });
    await prisma.academicYear.deleteMany({ where: { schoolId } });
    await prisma.studentProfile.deleteMany({
      where: { user: { email: { in: TEST_EMAILS } } },
    });
    for (const email of TEST_EMAILS) {
      const u = await prisma.user.findUnique({ where: { email } });
      if (u) {
        await prisma.schoolMembership.deleteMany({ where: { userId: u.id } });
        await prisma.userRoleMembership.deleteMany({ where: { userId: u.id } });
        await prisma.user.delete({ where: { id: u.id } }).catch(() => undefined);
      }
    }
    await prisma.$disconnect();
  });

  describe('authorization', () => {
    it('requires students.view for list', async () => {
      const res = await studentAgent.get(BASE);
      expect(res.status).toBe(403);
    });

    it('allows DEAN (students.view) to list', async () => {
      const res = await deanAgent.get(BASE);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.transitions)).toBe(true);
    });

    it('requires students.manage for recording an exit', async () => {
      const res = await teacherAgent.post(BASE).send({
        studentId,
        reason: 'withdrawn',
      });
      expect(res.status).toBe(403);
    });

    it('requires students.view for detail', async () => {
      // Use a fake id - the student lacks students.view so should get 403
      const res = await studentAgent.get(`${BASE}/000000000000000000000000`);
      expect(res.status).toBe(403);
    });
  });

  describe('list', () => {
    it('returns 200 with transitions array for admin', async () => {
      const res = await adminAgent.get(BASE);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.transitions)).toBe(true);
      expect(typeof res.body.total).toBe('number');
    });
  });

  describe('record exit', () => {
    it('records an exit with reason completed', async () => {
      const res = await adminAgent.post(BASE).send({
        studentId,
        reason: 'completed',
        notes: 'Finished Grade 7',
      });
      expect(res.status).toBe(201);
      expect(res.body.transition.reason).toBe('completed');
      expect(res.body.transition.isRestored).toBe(false);
      expect(res.body.transition.studentProfileId).toBe(studentId);
      exitId = res.body.transition.id;
    });

    it('archives the learner account alongside the exit', async () => {
      const user = await prisma.user.findUnique({ where: { id: studentUserId } });
      expect(user?.status).toBe('archived');
    });

    it('rejects a second open exit for the same learner', async () => {
      const res = await adminAgent.post(BASE).send({
        studentId,
        reason: 'withdrawn',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('detail with timeline', () => {
    it('returns the transition with enrollment history and timeline', async () => {
      const res = await adminAgent.get(`${BASE}/${exitId}`);
      expect(res.status).toBe(200);
      expect(res.body.transition.id).toBe(exitId);
      expect(res.body.transition.enrollments).toBeInstanceOf(Array);
      expect(res.body.transition.enrollments.length).toBe(1);
      expect(res.body.transition.enrollments[0].className).toBe('Grade 7 East');
      expect(res.body.transition.enrollments[0].academicYear?.name).toBe('2026');
      expect(res.body.transition.history).toBeInstanceOf(Array);
      expect(res.body.transition.history[0].isRestored).toBe(false);
      expect(res.body.transition.recordedBy).toBeTruthy();
    });

    it('returns 404 for unknown transition', async () => {
      const res = await adminAgent.get(`${BASE}/000000000000000000000000`);
      expect(res.status).toBe(404);
    });
  });

  describe('restore', () => {
    it('restores the learner and reactivates the account', async () => {
      const res = await adminAgent.post(`${BASE}/${exitId}/restore`).send({
        targetGradeLevel: 'Grade 8',
        notes: 'Returning for next year',
      });
      expect(res.status).toBe(200);
      expect(res.body.transition.isRestored).toBe(true);
      expect(res.body.transition.restoredAt).not.toBeNull();

      const user = await prisma.user.findUnique({ where: { id: studentUserId } });
      expect(user?.status).toBe('active');
    });

    it('refuses a double restore', async () => {
      const res = await adminAgent.post(`${BASE}/${exitId}/restore`).send({});
      expect(res.status).toBe(409);
    });
  });

  describe('options', () => {
    it('returns filter options', async () => {
      const res = await adminAgent.get(`${BASE}/options`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.reasons)).toBe(true);
      expect(Array.isArray(res.body.academicYears)).toBe(true);
      expect(Array.isArray(res.body.classes)).toBe(true);
    });
  });

  describe('patch', () => {
    it('allows updating an unresolved exit', async () => {
      // Create a fresh exit for patching (the previous one is now restored)
      const res = await adminAgent.post(BASE).send({
        studentId,
        reason: 'withdrawn',
        notes: 'Initial note',
      });
      const newExitId = res.body.transition.id;

      const patchRes = await adminAgent.patch(`${BASE}/${newExitId}`).send({
        notes: 'Updated note',
      });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.transition.notes).toBe('Updated note');
    });

    it('rejects patching a restored exit', async () => {
      const patchRes = await adminAgent.patch(`${BASE}/${exitId}`).send({
        notes: 'Should not work',
      });
      expect(patchRes.status).toBe(409);
    });
  });
});
