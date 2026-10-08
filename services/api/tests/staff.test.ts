/**
 * Staff module tests.
 *
 * Covers the staff directory, profile creation, updates, and the academic
 * assignments endpoint that bridges Staff with the authoritative
 * StreamAllocation model.
 */

import request from 'supertest';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/staff`;

describe('Staff module', () => {
  let adminAgent: request.SuperAgentTest;
  let deanAgent: request.SuperAgentTest;
  let accountantAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;

  let schoolId: string;
  let otherSchoolId: string;
  let teacherUserId: string;
  let deanUserId: string;

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', PASSWORD);

    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    const other = await prisma.school.create({
      data: { name: 'Staff Other School', schoolCode: null },
    });
    otherSchoolId = other.id;

    const teacherRole = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
    const deanRole = await prisma.role.findUnique({ where: { name: 'DEAN' } });
    const accountantRole = await prisma.role.findUnique({ where: { name: 'ACCOUNTANT' } });

    const teacherHash = await import('argon2').then((m) => m.default.hash(PASSWORD));
    const deanHash = await import('argon2').then((m) => m.default.hash(PASSWORD));
    const accountantHash = await import('argon2').then((m) => m.default.hash(PASSWORD));

    const teacherUser = await prisma.user.create({
      data: {
        email: 'staff.teacher@school.example',
        name: 'Staff Teacher',
        passwordHash: teacherHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: teacherRole!.id } },
      },
    });
    teacherUserId = teacherUser.id;

    const deanUser = await prisma.user.create({
      data: {
        email: 'staff.dean@school.example',
        name: 'Staff Dean',
        passwordHash: deanHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: deanRole!.id } },
      },
    });
    deanUserId = deanUser.id;

    const accountantUser = await prisma.user.create({
      data: {
        email: 'staff.accountant@school.example',
        name: 'Staff Accountant',
        passwordHash: accountantHash,
        status: 'active',
        schoolMemberships: { create: { schoolId, isDefault: true } },
        roleMemberships: { create: { roleId: accountantRole!.id } },
      },
    });

    deanAgent = makeAuthAgent();
    await loginAs(deanAgent, 'staff.dean@school.example', PASSWORD);

    accountantAgent = makeAuthAgent();
    await loginAs(accountantAgent, 'staff.accountant@school.example', PASSWORD);

    teacherAgent = makeAuthAgent();
    await loginAs(teacherAgent, 'staff.teacher@school.example', PASSWORD);
  });

  afterAll(async () => {
    await prisma.staffProfile.deleteMany({
      where: { userId: { in: [teacherUserId, deanUserId] } },
    });
    await prisma.schoolMembership.deleteMany({
      where: { userId: { in: [teacherUserId, deanUserId] } },
    });
    await prisma.userRoleMembership.deleteMany({
      where: { userId: { in: [teacherUserId, deanUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [teacherUserId, deanUserId] } },
    });
    await prisma.school.deleteMany({ where: { id: otherSchoolId } });
    await prisma.$disconnect();
  });

  describe('authorization', () => {
    it('requires staff.view for list', async () => {
      const res = await teacherAgent.get(BASE);
      expect([403, 404]).toContain(res.status);
    });

    it('requires staff.manage for create', async () => {
      const res = await teacherAgent.post(BASE).send({ userId: teacherUserId });
      expect([403, 404]).toContain(res.status);
    });

    it('requires staff.manage for update', async () => {
      const res = await teacherAgent.put(`${BASE}/fake-id`).send({ status: 'active' });
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('list', () => {
    it('returns staff with school scope', async () => {
      const res = await adminAgent.get(`${BASE}?limit=5`);
      expect(res.status).toBe(200);
      expect(res.body.staff).toBeDefined();
      expect(Array.isArray(res.body.staff)).toBe(true);
    });

    it('includes assignments summary when requested', async () => {
      const res = await adminAgent.get(`${BASE}?include=assignments&limit=5`);
      expect(res.status).toBe(200);
      if (res.body.staff.length > 0) {
        expect(res.body.staff[0]).toHaveProperty('assignmentsSummary');
      }
    });

    it('filters by role', async () => {
      const res = await adminAgent.get(`${BASE}?role=TEACHER&limit=5`);
      expect(res.status).toBe(200);
      expect(res.body.staff.every((s: any) => s.roles.some((r: any) => r.name === 'TEACHER'))).toBe(true);
    });

    it('searches by name', async () => {
      const res = await adminAgent.get(`${BASE}?search=Staff&limit=5`);
      expect(res.status).toBe(200);
    });
  });

  describe('create', () => {
    it('creates a staff profile for an existing user', async () => {
      const res = await adminAgent.post(BASE).send({
        userId: teacherUserId,
        position: 'Mathematics Teacher',
        department: 'Academics',
        employeeId: 'EMP-001',
        hireDate: '2024-01-15',
      });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.userId).toBe(teacherUserId);
      expect(res.body.position).toBe('Mathematics Teacher');
    });

    it('rejects duplicate staff profiles', async () => {
      const res = await adminAgent.post(BASE).send({
        userId: teacherUserId,
        position: 'Duplicate',
      });
      expect(res.status).toBe(409);
    });

    it('rejects users from another school', async () => {
      const foreignUser = await prisma.user.create({
        data: {
          email: 'staff.foreign@other.example',
          name: 'Foreign',
          passwordHash: await import('argon2').then((m) => m.default.hash(PASSWORD)),
          status: 'active',
          schoolMemberships: { create: { schoolId: otherSchoolId, isDefault: true } },
        },
      });
      const res = await adminAgent.post(BASE).send({ userId: foreignUser.id });
      expect(res.status).toBe(404);
      await prisma.user.delete({ where: { id: foreignUser.id } });
    });
  });

  describe('update', () => {
    let staffId: string;

    beforeEach(async () => {
      const created = await prisma.staffProfile.findFirst({
        where: { userId: deanUserId },
      });
      if (!created) {
        const profile = await prisma.staffProfile.create({
          data: {
            userId: deanUserId,
            position: 'Dean',
            department: 'Academics',
          },
        });
        staffId = profile.id;
      } else {
        staffId = created.id;
      }
    });

    it('updates position and department', async () => {
      const res = await adminAgent.put(`${BASE}/${staffId}`).send({
        position: 'Senior Dean',
        department: 'Academic Affairs',
      });
      expect(res.status).toBe(200);
      expect(res.body.position).toBe('Senior Dean');
      expect(res.body.department).toBe('Academic Affairs');
    });

    it('updates employment status', async () => {
      const res = await adminAgent.put(`${BASE}/${staffId}`).send({
        status: 'on_leave',
      });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('on_leave');
    });

    it('returns 404 for unknown staff', async () => {
      const res = await adminAgent.put(`${BASE}/000000000000000000000000`).send({
        position: 'X',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('get by id', () => {
    it('returns the staff member by id', async () => {
      const listRes = await adminAgent.get(`${BASE}?limit=1`);
      const first = listRes.body.staff?.[0];
      if (!first) {
        return;
      }
      const res = await adminAgent.get(`${BASE}/${first.id}`);
      expect(res.status).toBe(200);
      expect(res.body.staff).toBeDefined();
      expect(res.body.staff[0].id).toBe(first.id);
    });

    it('returns 404 for unknown staff', async () => {
      const res = await adminAgent.get(`${BASE}/000000000000000000000000`);
      expect(res.status).toBe(404);
    });
  });

  describe('assignments', () => {
    let staffId: string;
    let academicYearId: string;
    let classId: string;
    let streamId: string;
    let subjectId: string;

    beforeAll(async () => {
      const profile = await prisma.staffProfile.findFirst({
        where: { userId: teacherUserId },
      });
      staffId = profile?.id ?? '000000000000000000000000';

      const session = await prisma.academicYear.create({
        data: {
          schoolId,
          name: `staff-assign-${Date.now()}`,
          label: 'Staff assignments session',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'active',
        },
      });
      academicYearId = session.id;

      const cls = await prisma.class.create({
        data: { schoolId, name: 'Staff Assign Class', gradeLevel: 'Form 1' },
      });
      classId = cls.id;

      const stream = await prisma.stream.create({
        data: { classId, name: 'Staff Stream', code: 'S' },
      });
      streamId = stream.id;

      const subject = await prisma.subject.create({
        data: { schoolId, name: 'Staff Subject', code: 'SS' },
      });
      subjectId = subject.id;
    });

    afterAll(async () => {
      await prisma.streamAllocation.deleteMany({
        where: { schoolId, streamId },
      });
      await prisma.stream.deleteMany({ where: { id: streamId } });
      await prisma.class.deleteMany({ where: { id: classId } });
      await prisma.subject.deleteMany({ where: { id: subjectId } });
      await prisma.academicYear.deleteMany({ where: { id: academicYearId } });
    });

    it('returns empty assignments for staff with none', async () => {
      const res = await adminAgent.get(`${BASE}/${deanUserId}/assignments`);
      expect(res.status).toBe(200);
      expect(res.body.teacher).toBeDefined();
      expect(res.body.assignments).toEqual([]);
    });

    it('returns assignments when they exist', async () => {
      await prisma.streamAllocation.create({
        data: {
          schoolId,
          academicYearId,
          streamId,
          teacherId: teacherUserId,
          responsibility: 'main_class_teacher',
          status: 'active',
        },
      });

      const res = await adminAgent.get(`${BASE}/${teacherUserId}/assignments`);
      expect(res.status).toBe(200);
      expect(res.body.teacher.id).toBe(teacherUserId);
      expect(res.body.assignments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.assignments[0].responsibility).toBe('main_class_teacher');
    });

    it('returns 404 for staff in another school', async () => {
      const foreign = await prisma.user.create({
        data: {
          email: 'staff.assign.foreign@other.example',
          name: 'Foreign',
          passwordHash: await import('argon2').then((m) => m.default.hash(PASSWORD)),
          status: 'active',
          schoolMemberships: { create: { schoolId: otherSchoolId, isDefault: true } },
        },
      });
      const res = await adminAgent.get(`${BASE}/${foreign.id}/assignments`);
      expect(res.status).toBe(404);
      await prisma.user.delete({ where: { id: foreign.id } });
    });
  });
});
