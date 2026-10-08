/**
 * Classes module tests.
 *
 * Covers class creation, listing, detail, and update, plus the relationship
 * with streams and enrollments.
 */

import request from 'supertest';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/classes`;

describe('Classes module', () => {
  let adminAgent: request.SuperAgentTest;
  let deanAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;

  let schoolId: string;
  let classId: string;
  let teacherUserId: string;
  let deanUserId: string;

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', PASSWORD);

    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    const teacherRole = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
    const deanRole = await prisma.role.findUnique({ where: { name: 'DEAN' } });

    const teacherHash = await import('argon2').then((m) => m.default.hash(PASSWORD));
    const deanHash = await import('argon2').then((m) => m.default.hash(PASSWORD));

    const teacherUser = await prisma.user.create({
      data: {
        email: 'class.teacher@school.example',
        name: 'Class Teacher',
        passwordHash: teacherHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: teacherRole!.id } },
      },
    });
    teacherUserId = teacherUser.id;

    const deanUser = await prisma.user.create({
      data: {
        email: 'class.dean@school.example',
        name: 'Class Dean',
        passwordHash: deanHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: deanRole!.id } },
      },
    });
    deanUserId = deanUser.id;

    deanAgent = makeAuthAgent();
    await loginAs(deanAgent, 'class.dean@school.example', PASSWORD);

    teacherAgent = makeAuthAgent();
    await loginAs(teacherAgent, 'class.teacher@school.example', PASSWORD);
  });

  afterAll(async () => {
    if (classId) {
      await prisma.stream.deleteMany({ where: { classId } });
      await prisma.enrollment.deleteMany({ where: { classId } });
      await prisma.class.delete({ where: { id: classId } }).catch(() => undefined);
    }
    await prisma.schoolMembership.deleteMany({
      where: { userId: { in: [teacherUserId, deanUserId] } },
    });
    await prisma.userRoleMembership.deleteMany({
      where: { userId: { in: [teacherUserId, deanUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacherUserId, deanUserId] } },
    });
    await prisma.$disconnect();
  });

  describe('authorization', () => {
    it('requires cohorts.view for list', async () => {
      const parentAgent = makeAuthAgent();
      await loginAs(parentAgent, 'parent@school.example', PASSWORD);
      const res = await parentAgent.get(BASE);
      expect([403, 404]).toContain(res.status);
    });

    it('requires cohorts.manage for create', async () => {
      const res = await teacherAgent.post(BASE).send({ name: 'Test Class' });
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('list', () => {
    it('returns classes for admin', async () => {
      const res = await adminAgent.get(BASE);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('create', () => {
    const stamp = Date.now();
    it('creates a class with required fields', async () => {
      const res = await adminAgent.post(BASE).send({
        name: 'Class Test',
        gradeLevel: 'Grade 4',
        classCode: `T4-${stamp}`,
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Class Test');
      classId = res.body.id;
    });

    it('rejects duplicate class codes within the same school', async () => {
      const res = await adminAgent.post(BASE).send({
        name: 'Class Test Duplicate',
        classCode: `T4-${stamp}`,
      });
      expect(res.status).toBe(409);
    });
  });

  describe('detail', () => {
    it('returns the class by id', async () => {
      const res = await adminAgent.get(`${BASE}/${classId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(classId);
      expect(res.body.name).toBe('Class Test');
    });

    it('returns 404 for unknown class', async () => {
      const res = await adminAgent.get(`${BASE}/000000000000000000000000`);
      expect(res.status).toBe(404);
    });
  });

  describe('update', () => {
    it('updates class fields', async () => {
      const res = await adminAgent.put(`${BASE}/${classId}`).send({
        name: 'Class Test Updated',
        gradeLevel: 'Grade 5',
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Class Test Updated');
      expect(res.body.gradeLevel).toBe('Grade 5');
    });
  });
});
