/**
 * Regression tests for the Progress Observations module.
 *
 * These tests verify:
 *  - Class-level teaching allocations (StreamAllocation with streamId null) resolve
 *    correctly, returning enrolled learners for a main-class/assistant-class teacher.
 *  - The learner-progress API surfaces the right learners, grades, and observations.
 *  - Observation CRUD (create, read, update, delete) is scope-enforced.
 *  - Access control rejects unauthenticated users and users without progress.manage.
 *
 * All fixtures are created in beforeAll and cleaned up in afterAll, because the
 * test database (schoolos_test) is seeded only with roles and permissions — not
 * with academic years, classes, or users.
 */

import request from 'supertest';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';
import argon2 from 'argon2';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/progress`;

describe('Learner Progress', () => {
  let teacherAgent: any;

  // Shared fixtures.
  let schoolId: string;
  let academicYearId: string;
  let classId: string;
  let teacherId: string;
  let teacherEmail: string;

  const cleanupUserIds: string[] = [];
  const cleanupRolePermissions: Array<{ roleId: string; permissionId: string }> = [];

  beforeAll(async () => {
    // Pick an existing school from the test database.
    const school = await prisma.school.findFirst();
    schoolId = school!.id;
    const stamp = Date.now();

    // Create a dedicated academic session.
    const session = await prisma.academicYear.create({
      data: {
        schoolId,
        name: `progress-test-${stamp}`,
        label: 'Progress Test Session',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'active',
      },
    });
    academicYearId = session.id;

    // Create a class with NO streams.
    const cls = await prisma.class.create({
      data: {
        schoolId,
        name: 'Progress Test Class',
        gradeLevel: '1',
        academicYearId,
      },
    });
    classId = cls.id;

    // Create a teacher user.
    const role = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
    teacherEmail = `progress.teacher.${stamp}@school.example`;

    const teacher = await prisma.user.create({
      data: {
        email: teacherEmail,
        name: 'Progress Test Teacher',
        passwordHash: await argon2.hash(PASSWORD),
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: {
          create: { roleId: role!.id },
        },
      },
    });
    teacherId = teacher.id;
    cleanupUserIds.push(teacherId);

    // Ensure the TEACHER role has progress.view and progress.manage.
    const viewPerm = await prisma.permission.findUnique({ where: { key: 'progress.view' } });
    const managePerm = await prisma.permission.findUnique({ where: { key: 'progress.manage' } });

    await prisma.rolePermission.createMany({
      data: [
        { roleId: role!.id, permissionId: viewPerm!.id },
        { roleId: role!.id, permissionId: managePerm!.id },
      ],
    });
    cleanupRolePermissions.push({ roleId: role!.id, permissionId: viewPerm!.id });
    cleanupRolePermissions.push({ roleId: role!.id, permissionId: managePerm!.id });

    // Create a class-level main-class-teacher allocation (streamId null).
    await prisma.streamAllocation.create({
      data: {
        schoolId,
        academicYearId,
        classId,
        teacherId,
        responsibility: 'main_class_teacher',
        canManage: true,
        canEnterResults: true,
        status: 'active',
      },
    });

    // Log in as the teacher.
    teacherAgent = makeAuthAgent();
    const loginRes = await loginAs(teacherAgent, teacherEmail, PASSWORD);
    expect(loginRes.status).toBe(200);
  });

  afterAll(async () => {
    // Clean up observations.
    await prisma.progressObservation.deleteMany({ where: { schoolId, teacherId } });

    // Clean up allocations.
    await prisma.streamAllocation.deleteMany({
      where: { schoolId, teacherId },
    });

    // Clean up students.
    for (const userId of cleanupUserIds) {
      await prisma.enrollment.deleteMany({ where: { studentId: userId } });
      await prisma.schoolMembership.deleteMany({ where: { userId } });
      await prisma.userRoleMembership.deleteMany({ where: { userId } });
      await prisma.studentProfile.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }

    // Clean up class and academic year.
    await prisma.stream.deleteMany({ where: { classId } });
    await prisma.class.delete({ where: { id: classId } });
    await prisma.academicYear.delete({ where: { id: academicYearId } });

    // Restore role permissions to original state (remove the ones we added).
    for (const rp of cleanupRolePermissions) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: rp.roleId, permissionId: rp.permissionId },
      });
    }

    await prisma.$disconnect();
  });

  /** Create a test student and enroll them in the test class. */
  async function createStudent(name: string): Promise<string> {
    const role = await prisma.role.findUnique({ where: { name: 'STUDENT' } });
    const stamp = Date.now();

    const student = await prisma.user.create({
      data: {
        email: `progress.student.${stamp}@school.example`,
        name,
        passwordHash: await argon2.hash(PASSWORD),
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: role!.id } },
        studentProfile: { create: { gradeLevel: '1' } },
      },
    });
    cleanupUserIds.push(student.id);

    await prisma.enrollment.create({
      data: { studentId: student.id, classId, academicYearId },
    });

    await new Promise((r) => setTimeout(r, 10));
    return student.id;
  }

  describe('class-level allocation scope', () => {
    it('resolves a class-level StreamAllocation (streamId null) and returns enrolled learners', async () => {
      await createStudent('Progress Student 0');
      await createStudent('Progress Student 1');

      const res = await teacherAgent.get(BASE + '/learners');

      expect(res.status).toBe(200);
      expect(res.body.learners.length).toBeGreaterThanOrEqual(2);
      const names = res.body.learners.map((l: { name: string | null }) => l.name);
      expect(names).toContain('Progress Student 0');
      expect(names).toContain('Progress Student 1');
      expect(res.body.academicYearId).toBe(academicYearId);
    });
  });

  describe('learner detail and observations', () => {
    let detailLearnerId: string;

    beforeAll(async () => {
      detailLearnerId = await createStudent('Progress Detail Student');
    });

    it('returns learner progress with class-level allocation scope', async () => {
      const res = await teacherAgent.get(`${BASE}/learner/${detailLearnerId}`);

      expect(res.status).toBe(200);
      expect(res.body.learner.name).toBe('Progress Detail Student');
      expect(res.body.learner.classes[0].allStreams).toBe(true);
      expect(res.body.learner.classes[0].entersAllAreas).toBe(true);
    });

    it('allows creating an observation for an authorised learner', async () => {
      const res = await teacherAgent.post(BASE + '/observation').send({
        learnerId: detailLearnerId,
        classId,
        text: 'Shows good participation in class discussions and group work.',
        visibility: 'finalised',
      });

      expect(res.status).toBe(201);
      expect(res.body.observation.text).toContain('good participation');
      expect(res.body.observation.visibility).toBe('finalised');
      expect(res.body.observation.teacherId).toBe(teacherId);

      // The observation should now appear in the learner detail.
      const detail = await teacherAgent.get(`${BASE}/learner/${detailLearnerId}`);
      expect(detail.body.observations.length).toBeGreaterThanOrEqual(1);
      expect(detail.body.observations[0].text).toContain('good participation');
    });

    it('lists observations for the teacher', async () => {
      const res = await teacherAgent.get(BASE + '/observations');
      expect(res.status).toBe(200);
      expect(res.body.observations.length).toBeGreaterThan(0);
    });

    it('allows editing an observation', async () => {
      const list = await teacherAgent.get(BASE + '/observations');
      const obsId = list.body.observations[0].id;

      const res = await teacherAgent
        .patch(`${BASE}/observation/${obsId}`)
        .send({ text: 'Updated: shows improved critical thinking.' });

      expect(res.status).toBe(200);
      expect(res.body.observation.text).toBe('Updated: shows improved critical thinking.');
    });

    it('deletes an observation', async () => {
      const list = await teacherAgent.get(BASE + '/observations');
      const obsId = list.body.observations[0].id;

      const res = await teacherAgent.delete(`${BASE}/observation/${obsId}`);
      expect(res.status).toBe(204);

      const after = await teacherAgent.get(BASE + '/observations');
      expect(after.body.observations).toHaveLength(0);
    });
  });

  describe('access control', () => {
    it('rejects unauthenticated access', async () => {
      const res = await request(appInstance).get(BASE + '/learners');
      expect(res.status).toBe(401);
    });

    it('requires progress.manage for creating observations', async () => {
      const role = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
      const perm = await prisma.permission.findUnique({ where: { key: 'progress.manage' } });
      expect(perm).not.toBeNull();

      await prisma.rolePermission.deleteMany({
        where: { roleId: role!.id, permissionId: perm!.id },
      });

      const viewer = makeAuthAgent();
      await loginAs(viewer, teacherEmail, PASSWORD);

      const res = await viewer.post(BASE + '/observation').send({
        learnerId: teacherId,
        classId,
        text: 'Should be forbidden.',
      });

      expect(res.status).toBe(403);

      // Restore the permission.
      await prisma.rolePermission.create({
        data: { roleId: role!.id, permissionId: perm!.id },
      });
    });
  });
});
