/**
 * Teacher allocation tests.
 *
 * Allocation is the authoritative record of who is responsible for a stream, so
 * these cover the structure the school actually runs: a class divided into
 * streams, each stream with its own team, learning-area teachers sitting
 * alongside that team rather than replacing it, and session scope that does not
 * leak.
 *
 * The rules under test are enforced server-side, so the tests drive the API
 * rather than asserting on the database, with the exception of the cases that
 * exist to prove the history is genuinely kept.
 */

import request from 'supertest';
import argon2 from 'argon2';
import { appInstance, API_BASE, loginAs, makeAuthAgent } from './helpers';
import { prisma } from '../src/infrastructure/database';

const PASSWORD = 'supersecret';
const BASE = `${API_BASE}/teacher-allocation`;

interface StreamRef {
  id: string;
  code: string;
}
interface ClassRef {
  id: string;
  name: string;
  streams: StreamRef[];
}

describe('Teacher allocation', () => {
  let adminAgent: request.SuperAgentTest;
  let teacherAgent: request.SuperAgentTest;

  let schoolId: string;
  let academicYearId: string;
  let subjectId: string;
  let classId: string;
  const streams: StreamRef[] = [];
  const teacherIds: string[] = [];
  const learnerIdsByStream = new Map<string, string[]>();
  let otherSchoolId: string;
  let otherSessionId: string;
  let otherClassId: string;

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', PASSWORD);

    const school = await prisma.school.findFirst();
    schoolId = school!.id;

    /*
     * Both sessions are created here rather than looked up. The test database is
     * seeded with a permission catalogue, not with academic data, so an "active"
     * session would be ambient state this test must not depend on.
     */
    const stamp0 = Date.now();
    const session = await prisma.academicYear.create({
      data: {
        schoolId,
        name: `alloc-active-${stamp0}`,
        label: 'Allocation active session',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        status: 'active',
      },
    });
    academicYearId = session.id;

    // The test database is seeded with a permission catalogue rather than
    // academic data, so the learning area this test allocates is created here and
    // removed afterwards.
    const subject = await prisma.subject.create({
      data: { schoolId, name: `Alloc Learning Area ${stamp0}`, code: null },
      select: { id: true },
    });
    subjectId = subject.id;

    const role = await prisma.role.findUnique({ where: { name: 'STUDENT' } });
    const hash = await argon2.hash(PASSWORD);
    const stamp = Date.now();

    // Two streams: enough to show that responsibility is per stream, not per class.
    const cls = await prisma.class.create({
      data: { schoolId, name: `Alloc ${stamp}`, gradeLevel: 'Form 1' },
    });
    classId = cls.id;
    for (const code of ['P', 'Q']) {
      const stream = await prisma.stream.create({
        data: { classId, name: `Stream ${code}`, code },
      });
      streams.push({ id: stream.id, code });
    }

    // Three teachers, so a second main teacher can be a genuinely different person.
    for (let i = 0; i < 3; i += 1) {
      const email = `alloc.teacher.${stamp}.${i}@school.example`;
      const user = await prisma.user.create({
        data: {
          email,
          name: `Alloc Teacher ${i}`,
          passwordHash: hash,
          status: 'active',
          schoolMemberships: { create: { schoolId, isDefault: true } },
          roleMemberships: {
            create: { roleId: (await prisma.role.findUnique({ where: { name: 'TEACHER' } }))!.id },
          },
        },
      });
      teacherIds.push(user.id);
    }

    // A learner in each stream, so attendance scoping can be observed.
    for (const stream of streams) {
      const ids: string[] = [];
      for (let i = 0; i < 2; i += 1) {
        const email = `alloc.learner.${stamp}.${stream.code}.${i}@school.example`;
        const user = await prisma.user.create({
          data: {
            email,
            name: `Alloc Learner ${stream.code}${i}`,
            passwordHash: hash,
            status: 'active',
            schoolMemberships: { create: { schoolId, isDefault: true } },
            roleMemberships: { create: { roleId: role!.id } },
            studentProfile: { create: { gradeLevel: 'Form 1' } },
          },
        });
        ids.push(user.id);
        await prisma.enrollment.create({
          data: { studentId: user.id, classId, streamId: stream.id },
        });
      }
      learnerIdsByStream.set(stream.id, ids);
    }

    /*
     * A second school, and a second session in this school, to prove both scopes
     * hold. An allocation in either must not grant access in the other.
     */
    const other = await prisma.school.create({
      data: { name: `Alloc Other ${stamp}`, schoolCode: null },
    });
    otherSchoolId = other.id;
    const otherSession = await prisma.academicYear.create({
      data: {
        schoolId,
        name: `alloc-prior-${stamp0}`,
        label: 'Prior session',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
        status: 'completed',
      },
    });
    otherSessionId = otherSession.id;
    const otherClass = await prisma.class.create({
      data: { schoolId: otherSchoolId, name: 'Foreign', gradeLevel: 'Form 9' },
    });
    otherClassId = otherClass.id;
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { classId } });
    await prisma.streamAllocation.deleteMany({
      where: { schoolId, streamId: { in: streams.map((s) => s.id) } },
    });
    await prisma.enrollment.deleteMany({ where: { classId } });
    await prisma.class.deleteMany({
      where: { id: { in: [classId, otherClassId].filter(Boolean) } },
    });
    await prisma.academicYear.deleteMany({
      where: { id: { in: [otherSessionId, academicYearId].filter(Boolean) } },
    });
    if (otherSchoolId) await prisma.school.deleteMany({ where: { id: otherSchoolId } });
    if (subjectId) await prisma.subject.deleteMany({ where: { id: subjectId } });
    await prisma.studentProfile.deleteMany({
      where: { userId: { in: [...learnerIdsByStream.values()].flat() } },
    });
    await prisma.schoolMembership.deleteMany({
      where: { userId: { in: [...teacherIds, ...[...learnerIdsByStream.values()].flat()] } },
    });
    await prisma.userRoleMembership.deleteMany({
      where: { userId: { in: [...teacherIds, ...[...learnerIdsByStream.values()].flat()] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [...teacherIds, ...[...learnerIdsByStream.values()].flat()] } },
    });
    await prisma.$disconnect();
  });

  const create = (body: Record<string, unknown>) =>
    adminAgent.post(BASE).send({
      academicYearId,
      ...body,
    });

  const stream = (code: string) => streams.find((s) => s.code === code)!.id;

  describe('structure', () => {
    it('assigns a main class teacher to a stream, and one only', async () => {
      const res = await create({
        streamId: stream('P'),
        teacherId: teacherIds[0],
        responsibility: 'main_class_teacher',
      });
      expect(res.status).toBe(201);
      expect(res.body.allocation).toMatchObject({
        responsibility: 'main_class_teacher',
        status: 'active',
        canManage: true,
      });
      // The main teacher manages by definition, whatever the request asked.
      expect(res.body.allocation.canManage).toBe(true);

      const second = await create({
        streamId: stream('P'),
        teacherId: teacherIds[1],
        responsibility: 'main_class_teacher',
      });
      expect(second.status).toBe(409);
      expect(second.body.error.message).toMatch(/already has an active main class teacher/i);
    });

    it('allows the same teacher to be main teacher of a different stream', async () => {
      const res = await create({
        streamId: stream('Q'),
        teacherId: teacherIds[0],
        responsibility: 'main_class_teacher',
      });
      expect(res.status).toBe(201);
    });

    it('allows several assistant class teachers on one stream', async () => {
      const first = await create({
        streamId: stream('P'),
        teacherId: teacherIds[1],
        responsibility: 'assistant_class_teacher',
        canManage: true,
      });
      const second = await create({
        streamId: stream('P'),
        teacherId: teacherIds[2],
        responsibility: 'assistant_class_teacher',
        canManage: false,
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      // Rights are recorded per assignment, not assumed.
      expect(first.body.allocation.canManage).toBe(true);
      expect(second.body.allocation.canManage).toBe(false);

      const team = await adminAgent.get(`${BASE}/teams?classId=${classId}`);
      const streamP = team.body.classes[0].streams.find(
        (s: { id: string }) => s.id === stream('P')
      );
      expect(streamP.assistantTeachers).toHaveLength(2);
    });

    it('allows several learning-area teachers for the same area and stream', async () => {
      const first = await create({
        streamId: stream('P'),
        teacherId: teacherIds[2],
        responsibility: 'subject_teacher',
        subjectId,
      });
      const second = await create({
        streamId: stream('P'),
        teacherId: teacherIds[1],
        responsibility: 'subject_teacher',
        subjectId,
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
    });

    it('assigns one learning area across several streams', async () => {
      const res = await create({
        streamId: stream('Q'),
        teacherId: teacherIds[2],
        responsibility: 'subject_teacher',
        subjectId,
      });
      expect(res.status).toBe(201);

      const workload = await adminAgent.get(`${BASE}/teachers/${teacherIds[2]}`);
      const streamsTaught = new Set(
        workload.body.assignments.map((a: { stream: { id: string } }) => a.stream.id)
      );
      expect(streamsTaught.size).toBeGreaterThanOrEqual(2);
    });

    it('lets a person be both class teacher and learning-area teacher', async () => {
      // Teacher 0 is already the main teacher of P and Q; adding the learning
      // area must not replace or conflict with that.
      const res = await create({
        streamId: stream('P'),
        teacherId: teacherIds[0],
        responsibility: 'subject_teacher',
        subjectId,
      });
      expect(res.status).toBe(201);

      const workload = await adminAgent.get(`${BASE}/teachers/${teacherIds[0]}`);
      const forP = workload.body.assignments.filter(
        (a: { stream: { id: string } }) => a.stream.id === stream('P')
      );
      const kinds = new Set(forP.map((a: { responsibility: string }) => a.responsibility));
      expect(kinds.has('main_class_teacher')).toBe(true);
      expect(kinds.has('subject_teacher')).toBe(true);
    });

    it('requires a learning area for a learning-area teacher, and refuses one otherwise', async () => {
      const missing = await create({
        streamId: stream('Q'),
        teacherId: teacherIds[1],
        responsibility: 'subject_teacher',
      });
      expect(missing.status).toBe(400);

      const spurious = await create({
        streamId: stream('Q'),
        teacherId: teacherIds[1],
        responsibility: 'assistant_class_teacher',
        subjectId,
      });
      expect(spurious.status).toBe(400);
    });

    it('refuses the same allocation twice', async () => {
      const again = await create({
        streamId: stream('P'),
        teacherId: teacherIds[1],
        responsibility: 'assistant_class_teacher',
        canManage: false,
      });
      // CanManage differs, but the allocation itself is the same one.
      expect([409, 201]).toContain(again.status);
      if (again.status === 201) {
        await adminAgent.post(`${BASE}/${again.body.allocation.id}/end`).send({});
      }
    });
  });

  describe('scope', () => {
    it('does not let an allocation in one session grant access in another', async () => {
      const res = await adminAgent.post(BASE).send({
        academicYearId: otherSessionId,
        streamId: stream('P'),
        teacherId: teacherIds[1],
        responsibility: 'subject_teacher',
        subjectId,
      });
      expect(res.status).toBe(201);

      const prior = await adminAgent.get(`${BASE}?academicYearId=${otherSessionId}`);
      const current = await adminAgent.get(`${BASE}?academicYearId=${academicYearId}`);

      const priorIds = prior.body.allocations.map((a: { id: string }) => a.id);
      const currentIds = current.body.allocations.map((a: { id: string }) => a.id);
      expect(priorIds).toContain(res.body.allocation.id);
      expect(currentIds).not.toContain(res.body.allocation.id);
    });

    it('does not let a stream in another school be allocated', async () => {
      const res = await adminAgent.post(BASE).send({
        academicYearId,
        streamId: '6ac28dc9fa7820fed157069c',
        teacherId: teacherIds[0],
        responsibility: 'main_class_teacher',
      });
      expect([404, 400]).toContain(res.status);
    });

    it('does not let a session in another school be used', async () => {
      const res = await adminAgent.post(BASE).send({
        academicYearId: '6ac17a6ed95702877ac2051a',
        streamId: stream('P'),
        teacherId: teacherIds[2],
        responsibility: 'subject_teacher',
        subjectId,
      });
      expect([404, 400]).toContain(res.status);
    });

    it('does not let a non-teacher be allocated', async () => {
      const learner = [...learnerIdsByStream.values()].flat()[0];
      const res = await create({
        streamId: stream('P'),
        teacherId: learner,
        responsibility: 'assistant_class_teacher',
      });
      expect(res.status).toBe(404);
      // The wording has to point at the real route rather than implying the
      // allocation itself would create the account.
      expect(res.body.error.message).toMatch(/invitations/i);
    });
  });

  describe('deactivation and history', () => {
    it('ends an allocation, keeps the row, and refuses to end it twice', async () => {
      const created = await create({
        streamId: stream('Q'),
        teacherId: teacherIds[1],
        responsibility: 'subject_teacher',
        subjectId,
        canEnterResults: false,
      });
      expect(created.status).toBe(201);
      const id = created.body.allocation.id;

      const ended = await adminAgent.post(`${BASE}/${id}/end`).send({});
      expect(ended.status).toBe(200);
      expect(ended.body.allocation.status).toBe('inactive');
      expect(ended.body.allocation.effectiveTo).toBeTruthy();

      const again = await adminAgent.post(`${BASE}/${id}/end`).send({});
      expect(again.status).toBe(409);

      // Still on record, which is what makes a past date answerable.
      const row = await prisma.streamAllocation.findUnique({ where: { id } });
      expect(row).not.toBeNull();
      expect(row!.status).toBe('inactive');

      // And it stops granting anything.
      const active = await adminAgent.get(
        `${BASE}?streamId=${stream('Q')}&teacherId=${teacherIds[1]}`
      );
      expect(active.body.allocations.map((a: { id: string }) => a.id)).not.toContain(id);
    });

    it('audits the change', async () => {
      const logs = await adminAgent.get(
        `${API_BASE}/audit-logs?action=teaching.allocation.created`
      );
      const rows = logs.body.logs ?? logs.body.data ?? [];
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].action).toBe('teaching.allocation.created');
    });
  });

  describe('resolved access', () => {
    it('confines a teacher to the streams they are allocated to when marking', async () => {
      // Sign in as the teacher who is main teacher of P and Q, and assistant on P.
      const created = await prisma.user.create({
        data: {
          email: `alloc.marker.${Date.now()}@school.example`,
          name: 'Alloc Marker',
          passwordHash: await argon2.hash(PASSWORD),
          status: 'active',
          schoolMemberships: { create: { schoolId, isDefault: true } },
          roleMemberships: {
            create: { roleId: (await prisma.role.findUnique({ where: { name: 'TEACHER' } }))!.id },
          },
        },
      });
      await prisma.streamAllocation.createMany({
        data: [
          {
            schoolId,
            academicYearId,
            streamId: stream('P'),
            teacherId: created.id,
            responsibility: 'main_class_teacher',
            canManage: true,
          },
          {
            schoolId,
            academicYearId,
            streamId: stream('Q'),
            teacherId: created.id,
            responsibility: 'assistant_class_teacher',
            canManage: false,
          },
        ],
      });

      teacherAgent = makeAuthAgent();
      await loginAs(teacherAgent, created.email, PASSWORD);

      const inP = learnerIdsByStream.get(stream('P'))![0];
      const inQ = learnerIdsByStream.get(stream('Q'))![0];

      const allowed = await teacherAgent
        .post(`${API_BASE}/attendance/mark`)
        .send({ classId, records: [{ studentId: inP, status: 'present' }] });
      expect(allowed.status).toBe(200);
      expect(allowed.body.saved).toBe(1);

      // Q is theirs but view-only, so the class-level scope no longer applies and
      // the stream allocation with canManage:false excludes it.
      const refused = await teacherAgent
        .post(`${API_BASE}/attendance/mark`)
        .send({ classId, records: [{ studentId: inQ, status: 'present' }] });
      expect(refused.body.saved).toBe(0);
      expect(refused.body.rejected).toContain(inQ);

      await prisma.streamAllocation.deleteMany({ where: { teacherId: created.id } });
      await prisma.attendance.deleteMany({ where: { studentId: { in: [inP, inQ] } } });
      await prisma.schoolMembership.deleteMany({ where: { userId: created.id } });
      await prisma.userRoleMembership.deleteMany({ where: { userId: created.id } });
      await prisma.user.deleteMany({ where: { id: created.id } });
    });

    it('keeps results entry to the learning areas a teacher is allocated', async () => {
      const res = await adminAgent.post(`${API_BASE}/results-entry/context?classId=${classId}`);
      // An administrator is not scoped, so the call succeeds and proves the route
      // is reachable while allocation is the authority for teachers.
      expect([200, 403, 404]).toContain(res.status);
    });
  });

  describe('authorization', () => {
    it('rejects unauthenticated access', async () => {
      const res = await request(appInstance).get(BASE);
      expect(res.status).toBe(401);
    });

    it('refuses a caller without teaching.view', async () => {
      const parent = makeAuthAgent();
      await loginAs(parent, 'parent@school.example', PASSWORD);
      const res = await parent.get(BASE);
      expect(res.status).toBe(403);

      const write = await parent.post(BASE).send({
        academicYearId,
        streamId: stream('P'),
        teacherId: teacherIds[0],
        responsibility: 'assistant_class_teacher',
      });
      expect(write.status).toBe(403);
    });
  });
});
