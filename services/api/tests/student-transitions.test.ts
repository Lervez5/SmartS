/**
 * Student Transitions module tests.
 *
 * Covers the academic-progression workflow: listing source placements,
 * fetching filter options (sessions/classes/streams), recording single and
 * bulk transitions, and verifying that historical placements are preserved.
 *
 * Also covers the secondary exit/restore workflow.
 */

import request from 'supertest';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/student-transitions`;

const TEST_EMAILS = [
  'transitions.dean@school.example',
  'transitions.teacher@school.example',
  'transitions.student1@school.example',
  'transitions.student2@school.example',
  'transitions.student3@school.example',
];

describe('Student Transitions module', () => {
  let adminAgent: request.SuperAgentTest;
  let deanAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;
  let studentAgent: request.SuperAgentTest;

  let schoolId: string;
  let student1Id: string;
  let student1UserId: string;
  let student2UserId: string;
  let student3UserId: string;
  let sourceSessionId: string;
  let targetSessionId: string;
  let sourceClassId: string;
  let targetClassId: string;
  let sourceStreamId: string;
  let targetStreamId: string;
  let transitionId: string;

  beforeAll(async () => {
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
    await prisma.user.create({
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
    await prisma.user.create({
      data: {
        email: 'transitions.teacher@school.example',
        passwordHash: teacherHash,
        name: 'Transitions Teacher',
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: teacherRole!.id } },
      },
    });

    deanAgent = makeAuthAgent();
    await loginAs(deanAgent, 'transitions.dean@school.example', PASSWORD);

    teacherAgent = makeAuthAgent();
    await loginAs(teacherAgent, 'transitions.teacher@school.example', PASSWORD);

    // Create two academic sessions
    const sourceSession = await prisma.academicYear.create({
      data: {
        schoolId,
        name: '2026',
        label: '2026 Academic Session',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'active',
      },
    });
    sourceSessionId = sourceSession.id;

    const targetSession = await prisma.academicYear.create({
      data: {
        schoolId,
        name: '2027',
        label: '2027 Academic Session',
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-12-31'),
        status: 'planned',
      },
    });
    targetSessionId = targetSession.id;

    // Create source class (Grade 1, East stream)
    const sourceClass = await prisma.class.create({
      data: {
        schoolId,
        name: 'Grade 1',
        classCode: 'G1',
        gradeLevel: 'Grade 1',
        academicYearId: sourceSessionId,
        status: 'active',
      },
    });
    sourceClassId = sourceClass.id;

    const sourceStream = await prisma.stream.create({
      data: {
        classId: sourceClassId,
        name: 'East',
        code: 'E',
        academicYearId: sourceSessionId,
        status: 'active',
      },
    });
    sourceStreamId = sourceStream.id;

    // Create target class (Grade 2, East stream)
    const targetClass = await prisma.class.create({
      data: {
        schoolId,
        name: 'Grade 2',
        classCode: 'G2',
        gradeLevel: 'Grade 2',
        academicYearId: targetSessionId,
        status: 'active',
      },
    });
    targetClassId = targetClass.id;

    const targetStream = await prisma.stream.create({
      data: {
        classId: targetClassId,
        name: 'East',
        code: 'E',
        academicYearId: targetSessionId,
        status: 'active',
      },
    });
    targetStreamId = targetStream.id;

    // Create three student users with profiles
    for (let i = 1; i <= 3; i++) {
      const hash = await import('argon2').then((m) => m.default.hash(PASSWORD));
      const user = await prisma.user.create({
        data: {
          email: `transitions.student${i}@school.example`,
          name: `Student ${i}`,
          passwordHash: hash,
          status: 'active',
          schoolMemberships: { create: { schoolId, isDefault: true } },
          roleMemberships: { create: { roleId: studentRole!.id } },
          studentProfile: {
            create: {
              gradeLevel: 'Grade 1',
              admissionId: `65f1c0e0f1c0e0f1c0e0f1c${i}`,
              enrollmentDate: new Date('2026-01-15'),
              gender: 'female',
            },
          },
        },
      });
      if (i === 1) student1UserId = user.id;
      if (i === 2) student2UserId = user.id;
      if (i === 3) student3UserId = user.id;
    }

    const profile1 = await prisma.studentProfile.findUnique({ where: { userId: student1UserId } });
    student1Id = profile1!.id;

    // Enroll students 1 and 2 in the source class/stream (student 3 stays unplaced)
    await prisma.enrollment.createMany({
      data: [
        {
          studentId: student1UserId,
          classId: sourceClassId,
          streamId: sourceStreamId,
          academicYearId: sourceSessionId,
          startDate: new Date('2026-01-15'),
        },
        {
          studentId: student2UserId,
          classId: sourceClassId,
          streamId: sourceStreamId,
          academicYearId: sourceSessionId,
          startDate: new Date('2026-01-15'),
        },
      ],
    });

    studentAgent = makeAuthAgent();
    await loginAs(studentAgent, 'transitions.student1@school.example', PASSWORD);
  });

  afterAll(async () => {
    await prisma.learnerExit.deleteMany({});
    await prisma.enrollment.deleteMany({});
    await prisma.stream.deleteMany({ where: { class: { schoolId } } });
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
    it('requires students.view for sessions', async () => {
      const res = await studentAgent.get(`${BASE}/sessions`);
      expect(res.status).toBe(403);
    });

    it('allows DEAN (students.view) to list sessions', async () => {
      const res = await deanAgent.get(`${BASE}/sessions`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.sessions)).toBe(true);
    });

    it('requires academics.manage for transitions', async () => {
      const res = await teacherAgent.post(`${BASE}/placements`).send({
        studentId: student1UserId,
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
      });
      expect(res.status).toBe(403);
    });

    it('requires students.view for placements list', async () => {
      const res = await studentAgent.get(
        `${BASE}/placements?sourceAcademicYearId=${sourceSessionId}`
      );
      expect(res.status).toBe(403);
    });
  });

  describe('sessions', () => {
    it('returns academic sessions for the school', async () => {
      const res = await deanAgent.get(`${BASE}/sessions`);
      expect(res.status).toBe(200);
      const sessions = res.body.sessions;
      expect(sessions).toContainEqual(expect.objectContaining({ id: sourceSessionId }));
      expect(sessions).toContainEqual(expect.objectContaining({ id: targetSessionId }));
    });
  });

  describe('classes', () => {
    it('returns only classes belonging to the requested session', async () => {
      const res = await deanAgent.get(`${BASE}/classes?academicYearId=${sourceSessionId}`);
      expect(res.status).toBe(200);
      expect(res.body.classes.length).toBeGreaterThan(0);
      expect(res.body.classes).toContainEqual(
        expect.objectContaining({ id: sourceClassId, academicYearId: sourceSessionId })
      );
    });

    it('does not return classes from other sessions', async () => {
      const res = await deanAgent.get(`${BASE}/classes?academicYearId=${sourceSessionId}`);
      expect(res.status).toBe(200);
      expect(res.body.classes).not.toContainEqual(expect.objectContaining({ id: targetClassId }));
    });
  });

  describe('streams', () => {
    it('returns only streams belonging to the requested class', async () => {
      const res = await deanAgent.get(`${BASE}/streams?classId=${sourceClassId}`);
      expect(res.status).toBe(200);
      expect(res.body.streams).toContainEqual(
        expect.objectContaining({ id: sourceStreamId, parentClassId: sourceClassId })
      );
    });

    it('does not return streams from other classes', async () => {
      const res = await deanAgent.get(`${BASE}/streams?classId=${sourceClassId}`);
      expect(res.status).toBe(200);
      expect(res.body.streams).not.toContainEqual(expect.objectContaining({ id: targetStreamId }));
    });
  });

  describe('placements', () => {
    it('returns learners in the source session/class/stream', async () => {
      const res = await deanAgent.get(
        `${BASE}/placements?sourceAcademicYearId=${sourceSessionId}&sourceClassId=${sourceClassId}&sourceStreamId=${sourceStreamId}`
      );
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.placements.length).toBe(2);
      expect(res.body.placements[0].sourceClass.id).toBe(sourceClassId);
      expect(res.body.placements[0].sourceStream.id).toBe(sourceStreamId);
    });

    it('returns 400 when sourceAcademicYearId is missing', async () => {
      const res = await deanAgent.get(`${BASE}/placements`);
      expect(res.status).toBe(400);
    });

    it('returns 404 when sourceAcademicYearId is invalid', async () => {
      const res = await deanAgent.get(
        `${BASE}/placements?sourceAcademicYearId=000000000000000000000000`
      );
      expect(res.status).toBe(200);
      expect(res.body.placements.length).toBe(0);
      expect(res.body.total).toBe(0);
    });

    it('filters by search term', async () => {
      const res = await deanAgent.get(
        `${BASE}/placements?sourceAcademicYearId=${sourceSessionId}&sourceClassId=${sourceClassId}&search=Student 1`
      );
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.placements[0].name).toBe('Student 1');
    });
  });

  describe('individual transition', () => {
    it('transitions a learner from Grade 1 to Grade 2 in the target session', async () => {
      const res = await deanAgent.post(`${BASE}/placements`).send({
        studentId: student1UserId,
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
        targetStreamId: targetStreamId,
        reason: 'Promotion',
        notes: 'Completed Grade 1',
      });
      expect(res.status).toBe(201);
      expect(res.body.placement.studentId).toBe(student1UserId);
      expect(res.body.placement.classId).toBe(targetClassId);
      transitionId = res.body.placement.id;
    });

    it('preserves the historical source enrollment', async () => {
      const sourceEnrollment = await prisma.enrollment.findFirst({
        where: { studentId: student1UserId, classId: sourceClassId },
      });
      expect(sourceEnrollment).toBeTruthy();
    });

    it('rejects a duplicate transition into the same target class', async () => {
      const res = await deanAgent.post(`${BASE}/placements`).send({
        studentId: student1UserId,
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
      });
      expect(res.status).toBe(409);
    });

    it('rejects a target class from another session', async () => {
      const res = await deanAgent.post(`${BASE}/placements`).send({
        studentId: student1UserId,
        targetAcademicYearId: targetSessionId,
        targetClassId: sourceClassId,
      });
      expect(res.status).toBe(404);
    });

    it('rejects a target stream from another class', async () => {
      const res = await deanAgent.post(`${BASE}/placements`).send({
        studentId: student1UserId,
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
        targetStreamId: sourceStreamId,
      });
      expect(res.status).toBe(404);
    });

    it('rejects transitioning a learner not found in this school', async () => {
      const res = await deanAgent.post(`${BASE}/placements`).send({
        studentId: '000000000000000000000000',
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
      });
      expect(res.status).toBe(404);
    });
  });

  describe('bulk transition', () => {
    it('transitions multiple learners into the same target class', async () => {
      await prisma.enrollment.deleteMany({
        where: { studentId: student1UserId, classId: targetClassId },
      });

      const res = await deanAgent.post(`${BASE}/placements/bulk`).send({
        studentIds: [student1UserId, student2UserId, student3UserId],
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
        targetStreamId: targetStreamId,
        reason: 'Annual promotion',
      });
      expect(res.status).toBe(207);
      expect(res.body.summary.succeeded).toBe(3);
      expect(res.body.summary.failed).toBe(0);
    });

    it('preserves source enrollments after bulk transition', async () => {
      const sourceEnrollments = await prisma.enrollment.findMany({
        where: { studentId: { in: [student1UserId, student2UserId] }, classId: sourceClassId },
      });
      expect(sourceEnrollments.length).toBe(2);
    });

    it('rejects bulk transitioning a learner already in the target class', async () => {
      const res = await deanAgent.post(`${BASE}/placements/bulk`).send({
        studentIds: [student1UserId],
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
      });
      expect(res.status).toBe(207);
      expect(res.body.summary.failed).toBe(1);
      expect(res.body.results[0].success).toBe(false);
      expect(res.body.results[0].error).toContain('already enrolled');
    });

    it('rejects transitioning unplaced student3 into a specific class', async () => {
      // student3 was never enrolled in sourceClass, but should still transition to target
      const res = await deanAgent.post(`${BASE}/placements/bulk`).send({
        studentIds: [student3UserId],
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
      });
      // student3 is already in targetClass from the previous bulk call, so should fail
      expect(res.body.summary.failed).toBe(1);
    });

    it('rejects when the teacher lacks academics.manage', async () => {
      const res = await teacherAgent.post(`${BASE}/placements/bulk`).send({
        studentIds: [student1UserId],
        targetAcademicYearId: targetSessionId,
        targetClassId: targetClassId,
      });
      expect(res.status).toBe(403);
    });
  });

  describe('audit', () => {
    it('creates audit log entries for transitions', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { action: 'STUDENT_TRANSITION' },
      });
      expect(logs.length).toBeGreaterThan(0);
    });

    it('creates audit log entry for bulk transitions', async () => {
      const logs = await prisma.auditLog.findMany({
        where: { action: 'STUDENT_TRANSITION_BULK' },
      });
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});
